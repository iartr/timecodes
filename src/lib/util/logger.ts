type Level = "debug" | "info" | "warn" | "error"

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function envLevel(): Level {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase()
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw
  return "info"
}

function shouldLog(level: Level): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[envLevel()]
}

function ts(): string {
  return new Date().toISOString()
}

function format(scope: string, level: Level, msg: string, meta?: Record<string, unknown>): string {
  const base = `${ts()} [${level.toUpperCase()}] [${scope}] ${msg}`
  if (!meta || Object.keys(meta).length === 0) return base
  let metaStr: string
  try {
    metaStr = JSON.stringify(meta)
  } catch {
    metaStr = String(meta)
  }
  return `${base} ${metaStr}`
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void
  info(msg: string, meta?: Record<string, unknown>): void
  warn(msg: string, meta?: Record<string, unknown>): void
  error(msg: string, meta?: Record<string, unknown>): void
  child(suffix: string): Logger
  time<T>(label: string, fn: () => Promise<T>): Promise<T>
}

export function createLogger(scope: string): Logger {
  const log = (level: Level, msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(level)) return
    const line = format(scope, level, msg, meta)
    if (level === "error") console.error(line)
    else if (level === "warn") console.warn(line)
    else console.log(line)
  }

  return {
    debug: (m, meta) => log("debug", m, meta),
    info: (m, meta) => log("info", m, meta),
    warn: (m, meta) => log("warn", m, meta),
    error: (m, meta) => log("error", m, meta),
    child: (suffix) => createLogger(`${scope}:${suffix}`),
    async time(label, fn) {
      const start = Date.now()
      log("info", `${label} — start`)
      try {
        const res = await fn()
        log("info", `${label} — done`, { ms: Date.now() - start })
        return res
      } catch (err) {
        log("error", `${label} — failed`, {
          ms: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
    },
  }
}

export function redact(value: string | undefined, keep = 4): string {
  if (!value) return "<unset>"
  if (value.length <= keep * 2) return "***"
  return `${value.slice(0, keep)}…${value.slice(-keep)}`
}
