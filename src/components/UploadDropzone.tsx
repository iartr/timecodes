"use client"

import { Upload, FileVideo, X } from "lucide-react"
import { useRef, useState, type DragEvent } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Props {
  value: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
  maxMb: number
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`
}

export function UploadDropzone({ value, onChange, disabled, maxMb }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hover, setHover] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = (file: File | null) => {
    setError(null)
    if (!file) return onChange(null)
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Файл слишком большой (макс. ${maxMb} МБ)`)
      return
    }
    onChange(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setHover(false)
    if (disabled) return
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileVideo className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{value.name}</div>
          <div className="text-xs text-muted-foreground">{formatSize(value.size)}</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Убрать файл"
          onClick={() => onChange(null)}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setHover(true)
        }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-6 py-10 text-center transition-colors",
          hover && "border-primary bg-primary/5",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
          <Upload className="h-5 w-5" />
        </div>
        <div className="text-sm font-medium">Перетащите файл или нажмите, чтобы выбрать</div>
        <div className="text-xs text-muted-foreground">MP4, MOV, MKV, MP3, WAV — до {maxMb} МБ</div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          disabled={disabled}
        />
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  )
}
