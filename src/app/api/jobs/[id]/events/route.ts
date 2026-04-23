import { getJob, subscribe } from "@/lib/jobs/store"
import type { JobEvent } from "@/lib/jobs/types"
import { createLogger } from "@/lib/util/logger"

const log = createLogger("api:events")

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 3600

function sseFormat(event: JobEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = getJob(id)
  if (!job) {
    log.warn("SSE requested for unknown job", { id })
    return new Response("Job not found", { status: 404 })
  }
  log.info("SSE client connected", { id, stage: job.stage })

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (data: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(data))
        } catch {}
      }

      safeEnqueue(sseFormat({ type: "snapshot", state: job }))

      if (job.stage === "done" && job.chapters) {
        safeEnqueue(sseFormat({ type: "done", chapters: job.chapters, durationSec: job.durationSec }))
      } else if (job.stage === "error" && job.error) {
        safeEnqueue(sseFormat({ type: "error", error: job.error }))
      }

      unsubscribe = subscribe(id, (event) => {
        safeEnqueue(sseFormat(event))
      })

      pingInterval = setInterval(() => safeEnqueue(`: ping\n\n`), 15000)

      req.signal.addEventListener("abort", () => {
        log.info("SSE client disconnected", { id })
        cleanup()
        try {
          controller.close()
        } catch {}
      })
    },
    cancel() {
      cleanup()
    },
  })

  function cleanup() {
    closed = true
    unsubscribe?.()
    unsubscribe = null
    if (pingInterval) {
      clearInterval(pingInterval)
      pingInterval = null
    }
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
