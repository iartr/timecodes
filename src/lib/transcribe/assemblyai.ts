import fs from "node:fs"
import { AssemblyAI } from "assemblyai"
import { env } from "@/lib/env"

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
  const client = new AssemblyAI({ apiKey: env().ASSEMBLYAI_API_KEY })

  opts.onStatus?.("uploading", 0)
  const uploadUrl = await client.files.upload(fs.createReadStream(opts.audioPath))
  if (opts.signal?.aborted) throw new Error("aborted")

  const submitted = await client.transcripts.submit({
    audio: uploadUrl,
    language_detection: true,
    punctuate: true,
    format_text: true,
  })

  const startedAt = Date.now()
  let lastStatus = ""
  while (true) {
    if (opts.signal?.aborted) throw new Error("aborted")
    const t = await client.transcripts.get(submitted.id)
    const status = t.status as string
    if (status !== lastStatus) {
      lastStatus = status
      opts.onStatus?.(status, Date.now() - startedAt)
    } else {
      opts.onStatus?.(status, Date.now() - startedAt)
    }
    if (status === "completed") {
      const words: TranscribeWord[] = (t.words ?? []).map((w) => ({
        start: w.start ?? 0,
        end: w.end ?? 0,
        text: w.text ?? "",
      }))
      return {
        text: t.text ?? "",
        words,
        durationMs: t.audio_duration ? t.audio_duration * 1000 : 0,
      }
    }
    if (status === "error") {
      throw new Error(`AssemblyAI: ${t.error ?? "unknown error"}`)
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
}
