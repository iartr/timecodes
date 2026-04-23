"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { UploadDropzone } from "./UploadDropzone"
import { UrlInput } from "./UrlInput"
import { ProgressStepper } from "./ProgressStepper"
import { ChaptersPanel } from "./ChaptersPanel"
import { isHttpUrl } from "@/lib/sources/detect"
import type { Chapter, JobEvent, Stage } from "@/lib/jobs/types"

interface Props {
  maxUploadMb: number
}

type Mode = "upload" | "url"

type StepStage = Exclude<Stage, "error">

interface JobUI {
  id: string
  stage: StepStage
  progress: number
  subStatus?: string
  startedAt: number
  chapters?: Chapter[]
  error?: string
}

export function HomeClient({ maxUploadMb }: Props) {
  const [mode, setMode] = useState<Mode>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [job, setJob] = useState<JobUI | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const canSubmit =
    !submitting && (mode === "upload" ? !!file : !!url.trim() && isHttpUrl(url.trim()))

  const reset = () => {
    esRef.current?.close()
    esRef.current = null
    setJob(null)
    setFile(null)
    setUrl("")
    setSubmitting(false)
  }

  useEffect(() => {
    return () => {
      esRef.current?.close()
    }
  }, [])

  const submit = async () => {
    setSubmitting(true)
    try {
      let resp: Response
      if (mode === "upload") {
        if (!file) return
        const fd = new FormData()
        fd.append("file", file)
        resp = await fetch("/api/jobs", { method: "POST", body: fd })
      } else {
        resp = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        })
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Ошибка запроса" }))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const { jobId } = (await resp.json()) as { jobId: string }

      const startedAt = Date.now()
      setJob({ id: jobId, stage: "queued", progress: 0, startedAt })

      const es = new EventSource(`/api/jobs/${jobId}/events`)
      esRef.current = es
      es.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data) as JobEvent
          setJob((prev) => {
            if (!prev) return prev
            switch (event.type) {
              case "snapshot": {
                const s = event.state
                const nextStage: StepStage = s.stage === "error" ? prev.stage : s.stage
                return {
                  ...prev,
                  stage: nextStage,
                  progress: s.progress,
                  subStatus: s.subStatus,
                  chapters: s.chapters,
                  error: s.error,
                }
              }
              case "stage": {
                if (event.stage === "error") return prev
                return { ...prev, stage: event.stage, progress: 0, subStatus: event.subStatus }
              }
              case "progress":
                return {
                  ...prev,
                  progress: event.progress,
                  subStatus: event.subStatus ?? prev.subStatus,
                }
              case "done":
                es.close()
                return { ...prev, stage: "done", progress: 100, chapters: event.chapters }
              case "error":
                es.close()
                return { ...prev, error: event.error }
              default:
                return prev
            }
          })
        } catch {}
      }
      es.onerror = () => {
        // Browser will retry; we don't force-close on transient errors.
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(msg)
      setSubmitting(false)
    }
  }

  const showInput = !job
  const showProgress = job && job.stage !== "done"
  const showChapters = job?.stage === "done" && job.chapters

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {showInput && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Таймкоды за пару минут
              </h1>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Загрузите видео или вставьте ссылку — получите готовые главы с таймкодами.
              </p>
            </div>

            <Card className="border-border/80 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <TabsList className="mb-5 w-full">
                    <TabsTrigger value="upload" className="flex-1">
                      Загрузить файл
                    </TabsTrigger>
                    <TabsTrigger value="url" className="flex-1">
                      Ссылка
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload" className="m-0">
                    <UploadDropzone
                      value={file}
                      onChange={setFile}
                      disabled={submitting}
                      maxMb={maxUploadMb}
                    />
                  </TabsContent>
                  <TabsContent value="url" className="m-0">
                    <UrlInput value={url} onChange={setUrl} disabled={submitting} />
                  </TabsContent>
                </Tabs>
                <Button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="mt-5 h-11 w-full gap-2 text-sm"
                  size="lg"
                >
                  <Sparkles className="h-4 w-4" />
                  Сгенерировать таймкоды
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {showProgress && job && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <ProgressStepper
              stage={job.stage}
              progress={job.progress}
              subStatus={job.subStatus}
              startedAt={job.startedAt}
              error={job.error}
            />
            {job.error && (
              <Button variant="outline" onClick={reset} className="w-full">
                Попробовать снова
              </Button>
            )}
          </motion.div>
        )}

        {showChapters && job?.chapters && (
          <motion.div
            key="chapters"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ChaptersPanel chapters={job.chapters} onReset={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
