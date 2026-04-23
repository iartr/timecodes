import { promises as fs } from "node:fs"
import path from "node:path"
import { env } from "@/lib/env"
import { createLogger } from "@/lib/util/logger"
import { run, which } from "@/lib/util/spawn"

const log = createLogger("ffmpeg")

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
  if (configured) {
    log.info("using configured ffmpeg path", { path: configured })
    return configured
  }
  const found = await which("ffmpeg")
  if (!found) {
    log.error("ffmpeg not found in PATH")
    throw new Error("ffmpeg не найден в PATH. Установите ffmpeg или задайте FFMPEG_PATH.")
  }
  log.info("resolved ffmpeg from PATH", { path: found })
  return found
}

async function getFfmpegVersion(ffmpeg: string): Promise<string | null> {
  try {
    const { stdout, stderr, code } = await run(ffmpeg, ["-version"])
    if (code === 0) {
      const first = (stdout || stderr).split("\n")[0]?.trim()
      return first || null
    }
  } catch {}
  return null
}

export async function extractAudio(opts: ExtractOptions): Promise<ExtractResult> {
  const ffmpeg = await resolveFfmpeg()
  const version = await getFfmpegVersion(ffmpeg)

  const audioPath = path.join(opts.outputDir, "audio.mp3")

  let durationMs = 0
  let lastPercent = 0
  let stderrLines = 0

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

  const inputStat = await fs.stat(opts.input).catch(() => null)
  log.info("starting extraction", {
    input: opts.input,
    inputBytes: inputStat?.size,
    audioPath,
    ffmpegVersion: version,
  })
  log.debug("ffmpeg args", { args })

  const { code, stderr } = await run(ffmpeg, args, {
    signal: opts.signal,
    onStderr: (line) => {
      stderrLines += 1
      log.debug("stderr", { line })
      const durMatch = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/.exec(line)
      if (durMatch && !durationMs) {
        const [, h, m, s, cs] = durMatch
        durationMs = (parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10)) * 1000 + parseInt(cs, 10) * 10
        log.info("detected input duration", { durationMs })
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
    const tail = stderr.slice(-800).trim()
    log.error("ffmpeg failed", { code, stderrLines, tail })
    throw new Error(`ffmpeg завершился с ошибкой (code ${code}): ${tail}`)
  }

  const outStat = await fs.stat(audioPath).catch(() => null)
  log.info("extraction complete", {
    audioPath,
    audioBytes: outStat?.size,
    durationMs,
    stderrLines,
  })

  opts.onProgress?.(100)
  return { audioPath, durationMs }
}
