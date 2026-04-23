import path from "node:path"
import { env } from "@/lib/env"
import { run, which } from "@/lib/util/spawn"

export interface ExtractOptions {
  input: string
  outputDir: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export interface ExtractResult {
  audioPath: string
  durationMs: number
}

async function resolveFfmpeg(): Promise<string> {
  const configured = env().FFMPEG_PATH
  if (configured) return configured
  const found = await which("ffmpeg")
  if (!found) throw new Error("ffmpeg не найден в PATH. Установите ffmpeg или задайте FFMPEG_PATH.")
  return found
}

export async function extractAudio(opts: ExtractOptions): Promise<ExtractResult> {
  const ffmpeg = await resolveFfmpeg()
  const audioPath = path.join(opts.outputDir, "audio.mp3")

  let durationMs = 0
  let lastPercent = 0

  const args = [
    "-y",
    "-i",
    opts.input,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "64k",
    audioPath,
  ]

  const { code, stderr } = await run(ffmpeg, args, {
    signal: opts.signal,
    onStderr: (line) => {
      const durMatch = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/.exec(line)
      if (durMatch && !durationMs) {
        const [, h, m, s, cs] = durMatch
        durationMs = (parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10)) * 1000 + parseInt(cs, 10) * 10
      }
      const timeMatch = /time=(\d+):(\d+):(\d+)\.(\d+)/.exec(line)
      if (timeMatch && durationMs > 0) {
        const [, h, m, s, cs] = timeMatch
        const currentMs =
          (parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10)) * 1000 + parseInt(cs, 10) * 10
        const percent = Math.min(99, Math.round((currentMs / durationMs) * 100))
        if (percent !== lastPercent) {
          lastPercent = percent
          opts.onProgress?.(percent)
        }
      }
    },
  })

  if (code !== 0) {
    throw new Error(`ffmpeg завершился с ошибкой (code ${code}): ${stderr.slice(-500)}`)
  }

  opts.onProgress?.(100)
  return { audioPath, durationMs }
}
