"use client"

import { Link2 } from "lucide-react"
import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { detectSource, isHttpUrl } from "@/lib/sources/detect"

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function UrlInput({ value, onChange, disabled }: Props) {
  const detection = useMemo(() => {
    if (!value.trim()) return null
    if (!isHttpUrl(value.trim())) return { label: "Некорректная ссылка", kind: "invalid" as const }
    return detectSource(value.trim())
  }, [value])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://youtube.com/watch?v=..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-11 pl-9 text-sm"
        />
      </div>
      <div className="flex min-h-5 items-center gap-2">
        {detection && detection.kind === "invalid" && (
          <span className="text-xs text-destructive">Укажите корректную HTTP(S) ссылку</span>
        )}
        {detection && detection.kind !== "invalid" && (
          <Badge variant="secondary" className="font-medium">
            {detection.label}
          </Badge>
        )}
        {!detection && (
          <span className="text-xs text-muted-foreground">
            YouTube, Яндекс.Диск, Google Drive и другие (yt-dlp)
          </span>
        )}
      </div>
    </div>
  )
}
