import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream/promises"
import { Readable } from "node:stream"
import path from "node:path"

export interface UploadOptions {
  file: File
  outputDir: string
  onProgress?: (percent: number) => void
}

function pickExtension(filename: string, mime: string): string {
  const dot = filename.lastIndexOf(".")
  if (dot > 0 && dot < filename.length - 1) {
    return filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
  }
  if (mime.includes("mp4")) return "mp4"
  if (mime.includes("webm")) return "webm"
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3"
  if (mime.includes("wav")) return "wav"
  if (mime.includes("matroska")) return "mkv"
  if (mime.includes("quicktime")) return "mov"
  return "bin"
}

export async function saveUpload(opts: UploadOptions): Promise<string> {
  const ext = pickExtension(opts.file.name, opts.file.type || "")
  const outPath = path.join(opts.outputDir, `source.${ext}`)
  const ws = createWriteStream(outPath)

  const total = opts.file.size
  let written = 0
  let lastPercent = 0

  const webStream = opts.file.stream() as unknown as import("node:stream/web").ReadableStream<Uint8Array>
  const stream = Readable.fromWeb(webStream)
  if (total > 0 && opts.onProgress) {
    stream.on("data", (chunk: Buffer) => {
      written += chunk.length
      const p = Math.min(99, Math.floor((written / total) * 100))
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
