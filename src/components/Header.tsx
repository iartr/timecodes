"use client"

import { useTheme } from "next-themes"
import { Moon, Sun, AudioLines } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function Header() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <header className="w-full border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <AudioLines className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-semibold tracking-tight">Timecodes</span>
            <span className="text-[11px] text-muted-foreground">Таймкоды для видео</span>
          </div>
        </div>
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Переключить тему"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </header>
  )
}
