import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"

const ROOT = path.join(os.tmpdir(), "timecodes-app")

export async function ensureJobDir(jobId: string): Promise<string> {
  const dir = path.join(ROOT, jobId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function cleanupJobDir(jobId: string): Promise<void> {
  const dir = path.join(ROOT, jobId)
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
}

export async function sweepOldJobDirs(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await fs.mkdir(ROOT, { recursive: true })
    const entries = await fs.readdir(ROOT, { withFileTypes: true })
    const now = Date.now()
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory()) return
        const p = path.join(ROOT, entry.name)
        try {
          const stat = await fs.stat(p)
          if (now - stat.mtimeMs > maxAgeMs) {
            await fs.rm(p, { recursive: true, force: true })
          }
        } catch {}
      }),
    )
  } catch {}
}
