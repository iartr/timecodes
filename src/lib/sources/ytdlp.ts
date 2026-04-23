import { promises as fs } from "node:fs"
import path from "node:path"
import { env } from "@/lib/env"
import { run, which } from "@/lib/util/spawn"

export interface YtDlpOptions {
  url: string
  outputDir: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

async function resolveYtDlp(): Promise<string> {
  const configured = env().YTDLP_PATH
  if (configured) return configured
  const found = await which("yt-dlp")
  if (!found) {
    throw new Error("yt-dlp не найден в PATH. Установите yt-dlp или задайте YTDLP_PATH.")
  }
  return found
}

export async function downloadWithYtDlp(opts: YtDlpOptions): Promise<string> {
  const ytDlp = await resolveYtDlp()
  const cookies = env().YTDLP_COOKIES_FROM_BROWSER
  const outTemplate = path.join(opts.outputDir, "source.%(ext)s")

  const args = [
    "--no-playlist",
    "--no-part",
    "--no-progress",
    "--newline",
    "-f",
    "bestaudio/best",
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "5",
    "-o",
    outTemplate,
  ]
  if (cookies) args.push("--cookies-from-browser", cookies)
  args.push(opts.url)

  let lastPercent = 0

  const { code, stderr } = await run(ytDlp, args, {
    signal: opts.signal,
    onStdout: (line) => {
      const m = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line)
      if (m) {
        const p = Math.min(99, Math.floor(parseFloat(m[1])))
        if (p > lastPercent) {
          lastPercent = p
          opts.onProgress?.(p)
        }
      }
    },
    onStderr: () => {},
  })

  if (code !== 0) {
    const snippet = stderr.slice(-600).trim()
    if (/age|sign in|confirm|cookies/i.test(snippet)) {
      throw new Error(
        `yt-dlp: видео требует авторизации. Задайте YTDLP_COOKIES_FROM_BROWSER (например, "chrome") и попробуйте снова.\n\n${snippet}`,
      )
    }
    throw new Error(`yt-dlp завершился с ошибкой (code ${code}):\n${snippet}`)
  }

  const files = await fs.readdir(opts.outputDir)
  const audio = files.find((f) => f.startsWith("source.") && f.endsWith(".mp3"))
  if (audio) return path.join(opts.outputDir, audio)
  const any = files.find((f) => f.startsWith("source."))
  if (any) return path.join(opts.outputDir, any)
  throw new Error("yt-dlp не оставил выходного файла")
}
