"use client"

import { motion, AnimatePresence } from "motion/react"
import { Check, Loader2, X, Download, AudioLines, FileText, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { Stage } from "@/lib/jobs/types"
import { Progress } from "@/components/ui/progress"

const STEPS: { key: Stage; label: string; icon: typeof Download }[] = [
  { key: "source", label: "Загрузка", icon: Download },
  { key: "audio", label: "Аудио", icon: AudioLines },
  { key: "transcribe", label: "Транскрипция", icon: FileText },
  { key: "chapters", label: "Главы", icon: Sparkles },
]

interface Props {
  stage: Exclude<Stage, "error">
  progress: number
  subStatus?: string
  startedAt: number | null
  error?: string
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function ProgressStepper({ stage, progress, subStatus, startedAt, error }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 500)
    return () => clearInterval(id)
  }, [startedAt])

  const currentIdx = STEPS.findIndex((s) => s.key === stage)
  const isError = !!error
  const isDone = stage === "done" && !isError

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="relative flex items-start justify-between">
        <div className="absolute top-5 left-0 right-0 h-px bg-border" aria-hidden />
        {STEPS.map((step, idx) => {
          const active = !isError && !isDone && idx === currentIdx
          const completed = isDone || idx < currentIdx
          const failed = isError && idx === currentIdx
          const Icon = step.icon
          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-2">
              <motion.div
                initial={false}
                animate={{
                  scale: active ? [1, 1.05, 1] : 1,
                }}
                transition={{
                  duration: 1.4,
                  repeat: active ? Infinity : 0,
                  ease: "easeInOut",
                }}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background transition-colors",
                  completed && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary shadow-[0_0_0_4px] shadow-primary/15",
                  failed && "border-destructive text-destructive",
                  !active && !completed && !failed && "border-border text-muted-foreground",
                )}
              >
                {completed ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : failed ? (
                  <X className="h-4 w-4" strokeWidth={3} />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </motion.div>
              <div
                className={cn(
                  "text-[11px] font-medium leading-tight text-center",
                  (active || completed) && !failed && "text-foreground",
                  failed && "text-destructive",
                  !active && !completed && !failed && "text-muted-foreground",
                )}
              >
                {step.label}
              </div>
            </div>
          )
        })}
      </div>

      {!isError && !isDone && (
        <Progress value={Math.max(5, progress)} className="h-1.5" />
      )}

      <div className="flex items-center justify-between gap-3 text-xs">
        <AnimatePresence mode="wait">
          <motion.div
            key={subStatus ?? "idle"}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "min-w-0 flex-1 truncate",
              isError ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {isError ? error : (subStatus ?? "Подготовка…")}
          </motion.div>
        </AnimatePresence>
        {startedAt && !isDone && !isError && (
          <div className="shrink-0 tabular-nums text-muted-foreground">{formatElapsed(elapsed)}</div>
        )}
      </div>
    </div>
  )
}
