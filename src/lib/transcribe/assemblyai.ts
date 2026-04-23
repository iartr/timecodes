import fs from "node:fs"
import { AssemblyAI } from "assemblyai"
import { env } from "@/lib/env"
import { createLogger, redact } from "@/lib/util/logger"

const log = createLogger("assemblyai")

export interface TranscribeOptions {
  audioPath: string
  onStatus?: (status: string, elapsedMs: number) => void
  signal?: AbortSignal
}

export interface TranscribeWord {
  start: number
  end: number
  text: string
}

export interface TranscribeResult {
  text: string
  words: TranscribeWord[]
  durationMs: number
}

export async function transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
  const apiKey = env().ASSEMBLYAI_API_KEY
  log.info("initializing client", { apiKey: redact(apiKey) })
  const client = new AssemblyAI({ apiKey })

  const stat = fs.statSync(opts.audioPath)
  log.info("uploading audio", { audioPath: opts.audioPath, bytes: stat.size })
  opts.onStatus?.("uploading", 0)

  let uploadUrl: string
  const uploadStart = Date.now()
  try {
    uploadUrl = await client.files.upload(fs.createReadStream(opts.audioPath))
  } catch (err) {
    log.error("upload failed", { error: err instanceof Error ? err.message : String(err) })
    throw err
  }
  log.info("upload complete", { uploadUrl, ms: Date.now() - uploadStart })

  if (opts.signal?.aborted) {
    log.warn("aborted after upload")
    throw new Error("aborted")
  }

  const submitted = await client.transcripts.submit({
    audio: uploadUrl,
    speech_model: "universal",
    language_detection: true,
    punctuate: true,
    format_text: true,
  })
  log.info("transcript submitted", { transcriptId: submitted.id })

  const startedAt = Date.now()
  let lastStatus = ""
  let polls = 0
  while (true) {
    if (opts.signal?.aborted) {
      log.warn("aborted during polling", { polls, elapsedMs: Date.now() - startedAt })
      throw new Error("aborted")
    }
    polls += 1
    const t = await client.transcripts.get(submitted.id)
    const status = t.status as string
    const elapsedMs = Date.now() - startedAt
    if (status !== lastStatus) {
      log.info("status changed", { from: lastStatus || "(initial)", to: status, elapsedMs })
      lastStatus = status
      opts.onStatus?.(status, elapsedMs)
    } else {
      opts.onStatus?.(status, elapsedMs)
    }
    if (status === "completed") {
      const words: TranscribeWord[] = (t.words ?? []).map((w) => ({
        start: w.start ?? 0,
        end: w.end ?? 0,
        text: w.text ?? "",
      }))
      log.info("transcription completed", {
        polls,
        elapsedMs,
        words: words.length,
        textLen: (t.text ?? "").length,
        audioDurationSec: t.audio_duration,
      })
      return {
        text: t.text ?? "",
        words,
        durationMs: t.audio_duration ? t.audio_duration * 1000 : 0,
      }
    }
    if (status === "error") {
      log.error("AssemblyAI returned error", { error: t.error, polls, elapsedMs })
      throw new Error(`AssemblyAI: ${t.error ?? "unknown error"}`)
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
}
