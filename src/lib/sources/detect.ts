import type { SourceKind } from "@/lib/jobs/types"

export interface DetectedSource {
  kind: SourceKind
  label: string
}

export function detectSource(url: string): DetectedSource {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { kind: "generic", label: "Ссылка" }
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "")

  if (/(^|\.)youtube\.com$/.test(host) || host === "youtu.be" || host === "music.youtube.com") {
    return { kind: "youtube", label: "YouTube" }
  }
  if (host === "yadi.sk" || /(^|\.)disk\.yandex\.(ru|com|by|kz)$/.test(host) || /(^|\.)yandex\.(ru|com)$/.test(host) && u.pathname.startsWith("/d/")) {
    return { kind: "yadisk", label: "Яндекс.Диск" }
  }
  if (host === "drive.google.com" || host === "docs.google.com") {
    return { kind: "gdrive", label: "Google Drive" }
  }
  return { kind: "generic", label: "Ссылка" }
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}
