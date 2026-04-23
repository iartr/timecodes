import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream/promises"
import { Readable } from "node:stream"
import path from "node:path"

export interface YaDiskOptions {
  url: string
  outputDir: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

interface YaDiskDownloadResponse {
  href: string
  method?: string
  templated?: boolean
}

export async function downloadFromYandexDisk(opts: YaDiskOptions): Promise<string> {
  const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(opts.url)}`
  const metaResp = await fetch(apiUrl, { signal: opts.signal })
  if (!metaResp.ok) {
    if (metaResp.status === 404) {
      throw new Error("Яндекс.Диск: файл не найден. Убедитесь, что ссылка действует и файл публичный.")
    }
    throw new Error(`Яндекс.Диск: API вернул ошибку (${metaResp.status})`)
  }
  const meta = (await metaResp.json()) as YaDiskDownloadResponse
  if (!meta.href) throw new Error("Яндекс.Диск: не удалось получить ссылку на скачивание")

  const fileResp = await fetch(meta.href, { signal: opts.signal })
  if (!fileResp.ok || !fileResp.body) {
    throw new Error(`Яндекс.Диск: скачивание вернуло ${fileResp.status}`)
  }

  const total = Number(fileResp.headers.get("content-length") || 0)
  const contentType = fileResp.headers.get("content-type") || ""
  let ext = "bin"
  if (contentType.includes("mp4")) ext = "mp4"
  else if (contentType.includes("webm")) ext = "webm"
  else if (contentType.includes("mpeg") || contentType.includes("mp3")) ext = "mp3"
  else if (contentType.includes("matroska")) ext = "mkv"
  else if (contentType.includes("quicktime")) ext = "mov"
  else {
    const cd = fileResp.headers.get("content-disposition") || ""
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd)
    if (m) {
      const dot = m[1].lastIndexOf(".")
      if (dot > 0) ext = m[1].slice(dot + 1)
    }
  }

  const outPath = path.join(opts.outputDir, `source.${ext}`)
  const ws = createWriteStream(outPath)

  let downloaded = 0
  let lastPercent = 0
  const stream = Readable.fromWeb(fileResp.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>)

  if (total > 0 && opts.onProgress) {
    stream.on("data", (chunk: Buffer) => {
      downloaded += chunk.length
      const p = Math.min(99, Math.floor((downloaded / total) * 100))
      if (p > lastPercent) {
        lastPercent = p
        opts.onProgress?.(p)
      }
    })
  }

  await pipeline(stream, ws)
  opts.onProgress?.(100)
  return outPath
}
