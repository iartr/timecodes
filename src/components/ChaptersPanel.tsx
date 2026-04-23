"use client"

import { Copy, RefreshCw, Check } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { Chapter } from "@/lib/jobs/types"

interface Props {
  chapters: Chapter[]
  onReset: () => void
}

function chaptersToText(chapters: Chapter[]): string {
  return chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n")
}

export function ChaptersPanel({ chapters, onReset }: Props) {
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(chaptersToText(chapters))
      setCopiedAll(true)
      toast.success("Таймкоды скопированы")
      setTimeout(() => setCopiedAll(false), 1500)
    } catch {
      toast.error("Не удалось скопировать")
    }
  }

  const copyRow = async (idx: number, line: string) => {
    try {
      await navigator.clipboard.writeText(line)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1200)
    } catch {}
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <div className="text-sm font-semibold">Таймкоды</div>
          <div className="text-xs text-muted-foreground">{chapters.length} глав</div>
        </div>
        <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5">
          {copiedAll ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiedAll ? "Скопировано" : "Копировать всё"}
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {chapters.map((c, idx) => {
          const line = `${c.timestamp} ${c.title}`
          return (
            <li
              key={idx}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
            >
              <span className="font-mono text-xs font-medium tabular-nums text-primary">
                {c.timestamp}
              </span>
              <span className="flex-1 text-sm">{c.title}</span>
              <button
                type="button"
                onClick={() => copyRow(idx, line)}
                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                aria-label="Копировать строку"
              >
                {copiedIdx === idx ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="border-t border-border bg-muted/20 px-5 py-3">
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          Начать заново
        </Button>
      </div>
    </div>
  )
}
