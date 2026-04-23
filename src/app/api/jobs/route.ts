import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { createJob, setStage } from "@/lib/jobs/store"
import { runJob } from "@/lib/jobs/pipeline"
import { detectSource, isHttpUrl } from "@/lib/sources/detect"
import { sweepOldJobDirs } from "@/lib/util/tmp"
import { createLogger } from "@/lib/util/logger"

const log = createLogger("api:jobs")

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 3600

let sweepStarted = false
function startSweep() {
  if (sweepStarted) return
  sweepStarted = true
  log.info("starting tmp dir sweep")
  sweepOldJobDirs().catch((err) =>
    log.warn("initial sweep failed", { error: err instanceof Error ? err.message : String(err) }),
  )
  setInterval(
    () =>
      sweepOldJobDirs().catch((err) =>
        log.warn("periodic sweep failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      ),
    60 * 60 * 1000,
  ).unref?.()
}

export async function POST(req: Request) {
  startSweep()
  try {
    const contentType = req.headers.get("content-type") || ""
    const id = randomUUID()
    log.info("POST /api/jobs", { id, contentType })

    if (contentType.startsWith("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("file")
      if (!(file instanceof File)) {
        log.warn("upload missing file field", { id })
        return NextResponse.json({ error: "Файл не передан" }, { status: 400 })
      }
      const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024
      if (file.size > maxBytes) {
        log.warn("upload too large", { id, bytes: file.size, maxBytes })
        return NextResponse.json(
          { error: `Файл слишком большой (макс. ${env().MAX_UPLOAD_MB} МБ)` },
          { status: 413 },
        )
      }
      log.info("enqueuing upload job", {
        id,
        fileName: file.name,
        fileType: file.type,
        bytes: file.size,
      })
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
      log.warn("invalid URL submitted", { id, url })
      return NextResponse.json({ error: "Укажите корректную HTTP(S) ссылку" }, { status: 400 })
    }
    const detected = detectSource(url)
    log.info("enqueuing URL job", { id, kind: detected.kind, url })
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
    log.error("POST /api/jobs failed", {
      error: msg,
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
