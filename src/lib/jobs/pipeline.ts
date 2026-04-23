import { completeJob, failJob, setProgress, setStage } from "./store"
import type { SourceKind } from "./types"
import { cleanupJobDir, ensureJobDir } from "@/lib/util/tmp"
import { saveUpload } from "@/lib/sources/upload"
import { downloadWithYtDlp } from "@/lib/sources/ytdlp"
import { downloadFromYandexDisk } from "@/lib/sources/yadisk"
import { extractAudio } from "@/lib/audio/extract"
import { transcribe } from "@/lib/transcribe/assemblyai"
import { generateChapters } from "@/lib/chapters/openai"
import { createLogger } from "@/lib/util/logger"

export interface RunJobInput {
  id: string
  kind: SourceKind
  url?: string
  file?: File
}

export async function runJob(input: RunJobInput): Promise<void> {
  const { id } = input
  const log = createLogger(`job:${id.slice(0, 8)}`)
  const jobStart = Date.now()
  log.info("job started", {
    id,
    kind: input.kind,
    url: input.url,
    fileName: input.file?.name,
    fileSize: input.file?.size,
  })
  try {
    const dir = await ensureJobDir(id)
    log.info("job dir ready", { dir })

    setStage(id, "source", "Получение исходника…")
    let sourcePath: string
    const stageStart = Date.now()
    if (input.kind === "upload") {
      if (!input.file) throw new Error("Файл не передан")
      log.info("stage:source (upload) — start", {
        fileName: input.file.name,
        bytes: input.file.size,
      })
      sourcePath = await saveUpload({
        file: input.file,
        outputDir: dir,
        onProgress: (p) => setProgress(id, p, `Загрузка файла: ${p}%`),
      })
    } else if (input.kind === "yadisk") {
      if (!input.url) throw new Error("URL не передан")
      log.info("stage:source (yadisk) — start", { url: input.url })
      sourcePath = await downloadFromYandexDisk({
        url: input.url,
        outputDir: dir,
        onProgress: (p) => setProgress(id, p, `Скачивание с Яндекс.Диска: ${p}%`),
      })
    } else {
      if (!input.url) throw new Error("URL не передан")
      const label =
        input.kind === "youtube" ? "YouTube" : input.kind === "gdrive" ? "Google Drive" : "источника"
      log.info(`stage:source (${input.kind}) — start`, { url: input.url })
      sourcePath = await downloadWithYtDlp({
        url: input.url,
        outputDir: dir,
        onProgress: (p) => setProgress(id, p, `Скачивание с ${label}: ${p}%`),
      })
    }
    log.info("stage:source — done", { sourcePath, ms: Date.now() - stageStart })

    setStage(id, "audio", "Извлечение аудио…")
    const audioStart = Date.now()
    log.info("stage:audio — start", { input: sourcePath })
    const { audioPath, durationMs } = await extractAudio({
      input: sourcePath,
      outputDir: dir,
      onProgress: (p) => setProgress(id, p, `ffmpeg: ${p}%`),
    })
    log.info("stage:audio — done", {
      audioPath,
      durationMs,
      ms: Date.now() - audioStart,
    })

    setStage(id, "transcribe", "Отправка в AssemblyAI…")
    const transcribeStart = Date.now()
    log.info("stage:transcribe — start", { audioPath })
    const transcript = await transcribe({
      audioPath,
      onStatus: (status, elapsedMs) => {
        const secs = Math.floor(elapsedMs / 1000)
        const statusRu =
          status === "uploading"
            ? "Загрузка аудио"
            : status === "queued"
              ? "В очереди"
              : status === "processing"
                ? "Обработка на стороне AssemblyAI"
                : status
        setProgress(id, Math.min(95, secs / 2), `${statusRu}… ${secs}с`)
      },
    })
    log.info("stage:transcribe — done", {
      words: transcript.words.length,
      textLen: transcript.text.length,
      durationMs: transcript.durationMs,
      ms: Date.now() - transcribeStart,
    })

    if (transcript.words.length === 0) {
      log.error("empty transcript — no speech detected")
      throw new Error("Транскрипция пустая — возможно, в видео нет речи")
    }

    const videoDurationMs = transcript.durationMs || durationMs
    setStage(id, "chapters", "OpenAI генерирует главы…")
    setProgress(id, 30)
    const chaptersStart = Date.now()
    log.info("stage:chapters — start", {
      words: transcript.words.length,
      videoDurationMs,
    })
    const chapters = await generateChapters({
      words: transcript.words,
      durationMs: videoDurationMs,
    })
    log.info("stage:chapters — done", {
      chapters: chapters.length,
      ms: Date.now() - chaptersStart,
    })

    completeJob(id, chapters, Math.floor(videoDurationMs / 1000))
    log.info("job completed", { ms: Date.now() - jobStart, chapters: chapters.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    log.error("job failed", { error: msg, stack, ms: Date.now() - jobStart })
    failJob(id, msg)
  } finally {
    await cleanupJobDir(id).catch((err) => {
      log.warn("cleanup failed", { error: err instanceof Error ? err.message : String(err) })
    })
    log.info("job dir cleaned up")
  }
}
