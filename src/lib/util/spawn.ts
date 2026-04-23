import { spawn as nodeSpawn, type SpawnOptions } from "node:child_process"

export interface SpawnResult {
  stdout: string
  stderr: string
  code: number
}

export interface RunOptions extends SpawnOptions {
  onStdout?: (line: string) => void
  onStderr?: (line: string) => void
  signal?: AbortSignal
}

export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = nodeSpawn(cmd, args, {
      ...opts,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    let stdoutBuf = ""
    let stderrBuf = ""

    child.stdout?.on("data", (chunk: Buffer) => {
      const s = chunk.toString("utf8")
      stdout += s
      if (opts.onStdout) {
        stdoutBuf += s
        let idx: number
        while ((idx = stdoutBuf.search(/[\r\n]/)) !== -1) {
          const line = stdoutBuf.slice(0, idx)
          stdoutBuf = stdoutBuf.slice(idx + 1)
          if (line.trim()) opts.onStdout(line)
        }
      }
    })

    child.stderr?.on("data", (chunk: Buffer) => {
      const s = chunk.toString("utf8")
      stderr += s
      if (opts.onStderr) {
        stderrBuf += s
        let idx: number
        while ((idx = stderrBuf.search(/[\r\n]/)) !== -1) {
          const line = stderrBuf.slice(0, idx)
          stderrBuf = stderrBuf.slice(idx + 1)
          if (line.trim()) opts.onStderr(line)
        }
      }
    })

    if (opts.signal) {
      const onAbort = () => {
        try {
          child.kill("SIGTERM")
        } catch {}
      }
      opts.signal.addEventListener("abort", onAbort, { once: true })
    }

    child.on("error", (err) => reject(err))
    child.on("close", (code) => {
      if (opts.onStdout && stdoutBuf.trim()) opts.onStdout(stdoutBuf)
      if (opts.onStderr && stderrBuf.trim()) opts.onStderr(stderrBuf)
      resolve({ stdout, stderr, code: code ?? -1 })
    })
  })
}

export async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout, code } = await run("which", [cmd])
    if (code === 0) return stdout.trim()
  } catch {}
  return null
}
