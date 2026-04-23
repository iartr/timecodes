import { completeJob, failJob, setProgress, setStage } from "./store"
import type { SourceKind } from "./types"
import { cleanupJobDir, ensureJobDir } from "@/lib/util/tmp"
import { saveUpload } from "@/lib/sources/upload"
import { downloadWithYtDlp } from "@/lib/sources/ytdlp"
import { downloadFromYandexDisk } from "@/lib/sources/yadisk"
import { extractAudio } from "@/lib/audio/extract"
import { transcribe } from "@/lib/transcribe/assemblyai"
import { generateChapters } from "@/lib/chapters/openai"

export interface RunJobInput {
  id: string
  kind: SourceKind
  url?: string
  file?: File
}

export async function runJob(input: RunJobInput): Promise<void> {
  const { id } = input
  try {
    const dir = await ensureJobDir(id)

    setStage(id, "source", "Получение исходника…")
    let sourcePath: string
    if (input.kind === "upload") {
      if (!input.file) throw new Error("Файл не передан")
      sourcePath = await saveUpload({
        file: input.file,
        outputDir: dir,
        onProgress: (p) => setProgress(id, p, `Загрузка файла: ${p}%`),
      })
    } else if (input.kind === "yadisk") {
      if (!input.url) throw new Error("URL не передан")
      sourcePath = await downloadFromYandexDisk({
        url: input.url,
        outputDir: dir,
        onProgress: (p) => setProgress(id, p, `Скачивание с Яндекс.Диска: ${p}%`),
      })
    } else {
      if (!input.url) throw new Error("URL не передан")
      const label =
        input.kind === "youtube" ? "YouTube" : input.kind === "gdrive" ? "Google Drive" : "источника"
      sourcePath = await downloadWithYtDlp({
        url: input.url,
        outputDir: dir,
        onProgress: (p) => setProgress(id, p, `Скачивание с ${label}: ${p}%`),
      })
    }

    setStage(id, "audio", "Извлечение аудио…")
    const { audioPath, durationMs } = await extractAudio({
      input: sourcePath,
      outputDir: dir,
      onProgress: (p) => setProgress(id, p, `ffmpeg: ${p}%`),
    })

    setStage(id, "transcribe", "Отправка в AssemblyAI…")
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

    if (transcript.words.length === 0) {
      throw new Error("Транскрипция пустая — возможно, в видео нет речи")
    }

    const videoDurationMs = transcript.durationMs || durationMs
    setStage(id, "chapters", "OpenAI генерирует главы…")
    setProgress(id, 30)
    const chapters = await generateChapters({
      words: transcript.words,
      durationMs: videoDurationMs,
    })

    completeJob(id, chapters, Math.floor(videoDurationMs / 1000))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    failJob(id, msg)
  } finally {
    cleanupJobDir(id).catch(() => {})
  }
}
