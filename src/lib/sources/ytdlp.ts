import { promises as fs } from "node:fs"
import path from "node:path"
import { env } from "@/lib/env"
import { createLogger } from "@/lib/util/logger"
import { run, which } from "@/lib/util/spawn"

const log = createLogger("ytdlp")

export interface YtDlpOptions {
  url: string
  outputDir: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

async function resolveYtDlp(): Promise<string> {
  const configured = env().YTDLP_PATH
  if (configured) {
    log.info("using configured yt-dlp path", { path: configured })
    return configured
  }
  const found = await which("yt-dlp")
  if (!found) {
    log.error("yt-dlp not found in PATH")
    throw new Error("yt-dlp не найден в PATH. Установите yt-dlp или задайте YTDLP_PATH.")
  }
  log.info("resolved yt-dlp from PATH", { path: found })
  return found
}

async function getYtDlpVersion(ytDlp: string): Promise<string | null> {
  try {
    const { stdout, code } = await run(ytDlp, ["--version"])
    if (code === 0) return stdout.trim()
  } catch {}
  return null
}

async function resolveCookies(outputDir: string): Promise<{
  args: string[]
  cleanup: () => Promise<void>
  description: string
}> {
  const e = env()
  const fromBrowser = e.YTDLP_COOKIES_FROM_BROWSER?.trim()
  const cookiesFile = e.YTDLP_COOKIES_FILE?.trim()
  const cookiesContent = e.YTDLP_COOKIES_CONTENT?.trim()

  if (cookiesFile) {
    try {
      const stat = await fs.stat(cookiesFile)
      log.info("using cookies file", { path: cookiesFile, bytes: stat.size })
      return {
        args: ["--cookies", cookiesFile],
        cleanup: async () => {},
        description: `file:${cookiesFile}`,
      }
    } catch (err) {
      log.error("YTDLP_COOKIES_FILE is set but file is not readable", {
        path: cookiesFile,
        error: err instanceof Error ? err.message : String(err),
      })
      throw new Error(
        `yt-dlp: YTDLP_COOKIES_FILE=${cookiesFile} не читается. Проверьте путь и доступ.`,
      )
    }
  }

  if (cookiesContent) {
    const tmpPath = path.join(outputDir, "cookies.txt")
    await fs.writeFile(tmpPath, cookiesContent, { mode: 0o600 })
    log.info("wrote cookies from YTDLP_COOKIES_CONTENT to temp file", {
      path: tmpPath,
      bytes: cookiesContent.length,
    })
    return {
      args: ["--cookies", tmpPath],
      cleanup: async () => {
        await fs.rm(tmpPath, { force: true }).catch(() => {})
      },
      description: "env:YTDLP_COOKIES_CONTENT",
    }
  }

  if (fromBrowser) {
    log.warn(
      "YTDLP_COOKIES_FROM_BROWSER is set, but this option only works when the named browser is installed on the same machine as yt-dlp. On Railway / Docker there is no browser — use YTDLP_COOKIES_CONTENT or YTDLP_COOKIES_FILE instead.",
      { value: fromBrowser },
    )
    return {
      args: ["--cookies-from-browser", fromBrowser],
      cleanup: async () => {},
      description: `browser:${fromBrowser}`,
    }
  }

  log.info("no cookies configured")
  return { args: [], cleanup: async () => {}, description: "none" }
}

function parseExtraArgs(raw?: string): string[] {
  if (!raw) return []
  const out: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3])
  }
  return out
}

function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return /(^|\.)youtube\.com$/i.test(u.hostname) || /(^|\.)youtu\.be$/i.test(u.hostname)
  } catch {
    return false
  }
}

export async function downloadWithYtDlp(opts: YtDlpOptions): Promise<string> {
  const ytDlp = await resolveYtDlp()
  const version = await getYtDlpVersion(ytDlp)
  log.info("starting download", { url: opts.url, ytDlpVersion: version })

  const cookies = await resolveCookies(opts.outputDir)
  const extraArgs = parseExtraArgs(env().YTDLP_EXTRA_ARGS)
  const outTemplate = path.join(opts.outputDir, "source.%(ext)s")

  const youtubeArgs: string[] = isYouTubeUrl(opts.url)
    ? ["--extractor-args", "youtube:player_client=android,web,ios"]
    : []

  const args = [
    "--no-playlist",
    "--no-part",
    "--newline",
    "--progress",
    "--verbose",
    "-f",
    "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best",
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "5",
    "-o",
    outTemplate,
    ...cookies.args,
    ...youtubeArgs,
    ...extraArgs,
    opts.url,
  ]

  log.info("invoking yt-dlp", {
    cookies: cookies.description,
    extraArgs,
    outTemplate,
  })
  log.debug("yt-dlp args", { args })

  let lastPercent = 0
  const warnings: string[] = []
  const errors: string[] = []
  let stdoutLines = 0
  let stderrLines = 0

  try {
    const { code, stderr } = await run(ytDlp, args, {
      signal: opts.signal,
      onStdout: (line) => {
        stdoutLines += 1
        log.debug("stdout", { line })
        const m = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line)
        if (m) {
          const p = Math.min(99, Math.floor(parseFloat(m[1])))
          if (p > lastPercent) {
            lastPercent = p
            opts.onProgress?.(p)
          }
        }
      },
      onStderr: (line) => {
        stderrLines += 1
        if (/^WARNING/i.test(line)) {
          warnings.push(line)
          log.warn("yt-dlp warning", { line })
        } else if (/^ERROR/i.test(line)) {
          errors.push(line)
          log.error("yt-dlp error line", { line })
        } else {
          log.debug("stderr", { line })
        }
      },
    })

    log.info("yt-dlp exited", {
      code,
      stdoutLines,
      stderrLines,
      warnings: warnings.length,
      errors: errors.length,
    })

    if (code !== 0) {
      const tail = stderr.slice(-800).trim()
      const needsAuth = /sign in|sign-in|please log in|confirm you.?re not a bot|age.restrict/i.test(tail)
      const formatUnavailable =
        /requested format is not available|no video formats|no suitable formats/i.test(tail)
      if (needsAuth || formatUnavailable) {
        log.error("yt-dlp likely needs cookies", {
          cookies: cookies.description,
          reason: needsAuth ? "auth-required" : "format-unavailable",
          tail,
        })
        const header = formatUnavailable
          ? "yt-dlp: YouTube не отдал форматы. Обычно это бот-детект на серверных IP: нужны cookies или они устарели."
          : "yt-dlp: видео требует авторизации."
        throw new Error(
          [
            header,
            "На Railway опция --cookies-from-browser не работает (в контейнере нет браузера).",
            "Экспортируйте cookies из вашего браузера (Yandex Browser совместим с Chrome-форматом) в файл cookies.txt",
            "и задайте содержимое файла в переменной окружения YTDLP_COOKIES_CONTENT.",
            `Текущий источник cookies: ${cookies.description}.`,
            "",
            "Лог (последние 800 байт):",
            tail,
          ].join("\n"),
        )
      }
      log.error("yt-dlp failed", { code, tail })
      throw new Error(`yt-dlp завершился с ошибкой (code ${code}):\n${tail}`)
    }

    const files = await fs.readdir(opts.outputDir)
    log.debug("files in output dir", { files })
    const audio = files.find((f) => f.startsWith("source.") && f.endsWith(".mp3"))
    if (audio) {
      const outPath = path.join(opts.outputDir, audio)
      const st = await fs.stat(outPath)
      log.info("download complete", { file: audio, bytes: st.size })
      return outPath
    }
    const any = files.find((f) => f.startsWith("source."))
    if (any) {
      const outPath = path.join(opts.outputDir, any)
      const st = await fs.stat(outPath)
      log.warn("output file is not mp3", { file: any, bytes: st.size })
      return outPath
    }
    log.error("yt-dlp produced no output file", { files })
    throw new Error("yt-dlp не оставил выходного файла")
  } finally {
    await cookies.cleanup()
  }
}
