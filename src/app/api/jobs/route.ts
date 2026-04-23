import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { createJob, setStage } from "@/lib/jobs/store"
import { runJob } from "@/lib/jobs/pipeline"
import { detectSource, isHttpUrl } from "@/lib/sources/detect"
import { sweepOldJobDirs } from "@/lib/util/tmp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 3600

let sweepStarted = false
function startSweep() {
  if (sweepStarted) return
  sweepStarted = true
  sweepOldJobDirs().catch(() => {})
  setInterval(() => sweepOldJobDirs().catch(() => {}), 60 * 60 * 1000).unref?.()
}

export async function POST(req: Request) {
  startSweep()
  try {
    const contentType = req.headers.get("content-type") || ""
    const id = randomUUID()

    if (contentType.startsWith("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("file")
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Файл не передан" }, { status: 400 })
      }
      const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024
      if (file.size > maxBytes) {
        return NextResponse.json(
          { error: `Файл слишком большой (макс. ${env().MAX_UPLOAD_MB} МБ)` },
          { status: 413 },
        )
      }
      createJob({
        id,
        stage: "queued",
        sourceKind: "upload",
        sourceLabel: file.name,
      })
      setStage(id, "queued", "В очереди…")
      void runJob({ id, kind: "upload", file })
      return NextResponse.json({ jobId: id })
    }

    const body = (await req.json().catch(() => null)) as { url?: string } | null
    const url = body?.url?.trim()
    if (!url || !isHttpUrl(url)) {
      return NextResponse.json({ error: "Укажите корректную HTTP(S) ссылку" }, { status: 400 })
    }
    const detected = detectSource(url)
    createJob({
      id,
      stage: "queued",
      sourceKind: detected.kind,
      sourceLabel: detected.label,
    })
    setStage(id, "queued", "В очереди…")
    void runJob({ id, kind: detected.kind, url })
    return NextResponse.json({ jobId: id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
