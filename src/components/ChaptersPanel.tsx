"use client"

import { Copy, RefreshCw, Check } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { Chapter, InterestingTopic } from "@/lib/jobs/types"

interface Props {
  summary: string
  chapters: Chapter[]
  interestingTopics: InterestingTopic[]
  onReset: () => void
}

function analysisToText(summary: string, chapters: Chapter[], interestingTopics: InterestingTopic[]): string {
  const chapterLines = chapters
    .map((c) => `${c.timestamp} ${c.title} — ${c.description}`)
    .join("\n")
  const topicLines = interestingTopics
    .map((t) => `${t.timestamp} ${t.title} — ${t.reason}`)
    .join("\n")

  return [`Саммари`, summary, "", "Таймкоды", chapterLines, "", "Интересные топики", topicLines].join(
    "\n",
  )
}

export function ChaptersPanel({ summary, chapters, interestingTopics, onReset }: Props) {
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(analysisToText(summary, chapters, interestingTopics))
      setCopiedAll(true)
      toast.success("Разбор скопирован")
      setTimeout(() => setCopiedAll(false), 1500)
    } catch {
      toast.error("Не удалось скопировать")
    }
  }

  const copyRow = async (key: string, line: string) => {
    try {
      await navigator.clipboard.writeText(line)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1200)
    } catch {}
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <div className="text-sm font-semibold">Разбор видео</div>
          <div className="text-xs text-muted-foreground">{chapters.length} глав</div>
        </div>
        <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5">
          {copiedAll ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiedAll ? "Скопировано" : "Копировать всё"}
        </Button>
      </div>

      <section className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">Саммари</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{summary}</p>
      </section>

      <section className="border-b border-border">
        <div className="px-5 py-3">
          <h2 className="text-sm font-semibold">Таймкоды</h2>
        </div>
        <ul className="divide-y divide-border">
          {chapters.map((c, idx) => {
            const key = `chapter-${idx}`
            const line = `${c.timestamp} ${c.title} — ${c.description}`
            return (
              <li
                key={key}
                className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
              >
                <span className="mt-0.5 w-16 shrink-0 font-mono text-xs font-medium tabular-nums text-primary">
                  {c.timestamp}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="mt-1 text-sm leading-5 text-muted-foreground">{c.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyRow(key, line)}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  aria-label="Копировать строку"
                >
                  {copiedKey === key ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <div className="px-5 py-3">
          <h2 className="text-sm font-semibold">Интересные топики</h2>
        </div>
        <ul className="divide-y divide-border">
          {interestingTopics.map((t, idx) => {
            const key = `topic-${idx}`
            const line = `${t.timestamp} ${t.title} — ${t.reason}`
            return (
              <li
                key={key}
                className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
              >
                <span className="mt-0.5 w-16 shrink-0 font-mono text-xs font-medium tabular-nums text-primary">
                  {t.timestamp}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="mt-1 text-sm leading-5 text-muted-foreground">{t.reason}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyRow(key, line)}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  aria-label="Копировать строку"
                >
                  {copiedKey === key ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="border-t border-border bg-muted/20 px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="gap-1.5 text-muted-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Начать заново
        </Button>
      </div>
    </div>
  )
}
