export function formatTimestamp(ms: number, forceHours = false): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  if (h > 0 || forceHours) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

export function parseTimestamp(ts: string): number | null {
  const parts = ts.trim().split(":").map((p) => parseInt(p, 10))
  if (parts.some((p) => Number.isNaN(p))) return null
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
  return null
}

export function normalizeTimestamp(ts: string, videoDurationMs: number): string {
  const ms = parseTimestamp(ts)
  const forceHours = videoDurationMs > 3600 * 1000
  if (ms === null) return forceHours ? "00:00:00" : "00:00"
  return formatTimestamp(ms, forceHours)
}
