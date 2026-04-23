import OpenAI from "openai"
import { zodResponseFormat } from "openai/helpers/zod"
import { z } from "zod"
import { env } from "@/lib/env"
import { createLogger, redact } from "@/lib/util/logger"
import { formatTimestamp, normalizeTimestamp } from "./format"
import type { TranscribeWord } from "@/lib/transcribe/assemblyai"

const log = createLogger("openai")

const ChapterSchema = z.object({
  timestamp: z.string().describe("Таймкод в формате MM:SS или HH:MM:SS"),
  title: z.string().describe("Короткое название главы (2-6 слов)"),
})

const ChaptersSchema = z.object({
  chapters: z.array(ChapterSchema).min(1).max(25),
})

export type ChaptersResult = z.infer<typeof ChaptersSchema>["chapters"]

export interface GenerateChaptersOptions {
  words: TranscribeWord[]
  durationMs: number
  signal?: AbortSignal
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

function buildCompactTranscript(words: TranscribeWord[], segmentSec: number): string {
  if (words.length === 0) return ""
  const segMs = segmentSec * 1000
  const segments: { start: number; text: string[] }[] = []
  let current: { start: number; text: string[] } | null = null

  for (const w of words) {
    if (!current || w.start - current.start >= segMs) {
      current = { start: Math.floor(w.start / segMs) * segMs, text: [] }
      segments.push(current)
    }
    current.text.push(w.text)
  }

  return segments
    .map((s) => `[${formatTimestamp(s.start)}] ${s.text.join(" ").replace(/\s+/g, " ").trim()}`)
    .join("\n")
}

function modelContextLimit(model: string): number {
  if (model.includes("gpt-4o")) return 128_000
  if (model.includes("gpt-4.1")) return 1_000_000
  if (model.includes("o1") || model.includes("o3") || model.includes("o4")) return 200_000
  return 128_000
}

export async function generateChapters(opts: GenerateChaptersOptions): Promise<ChaptersResult> {
  const { OPENAI_API_KEY, OPENAI_MODEL, OPENAI_SYSTEM_PROMPT, OPENAI_TEMPERATURE } = env()
  log.info("initializing client", {
    apiKey: redact(OPENAI_API_KEY),
    model: OPENAI_MODEL,
    temperature: OPENAI_TEMPERATURE,
  })
  const client = new OpenAI({ apiKey: OPENAI_API_KEY })

  const limit = modelContextLimit(OPENAI_MODEL)
  const budget = Math.floor(limit * 0.6)

  let segmentSec = 30
  let transcript = buildCompactTranscript(opts.words, segmentSec)
  while (estimateTokens(transcript) > budget && segmentSec < 300) {
    segmentSec = segmentSec * 2
    transcript = buildCompactTranscript(opts.words, segmentSec)
  }
  log.info("built compact transcript", {
    segmentSec,
    estimatedTokens: estimateTokens(transcript),
    budget,
    transcriptLen: transcript.length,
  })

  const durationHint =
    opts.durationMs > 3600 * 1000
      ? `Длительность видео: ${formatTimestamp(opts.durationMs, true)} (используй формат HH:MM:SS).`
      : `Длительность видео: ${formatTimestamp(opts.durationMs)} (используй формат MM:SS).`

  const userMessage = `${durationHint}\n\nРасшифровка (формат: [MM:SS] текст):\n\n${transcript}`

  log.info("sending chat completion request", {
    model: OPENAI_MODEL,
    userMessageLen: userMessage.length,
    systemPromptLen: OPENAI_SYSTEM_PROMPT.length,
  })

  const reqStart = Date.now()
  let completion
  try {
    completion = await client.chat.completions.parse(
      {
        model: OPENAI_MODEL,
        temperature: OPENAI_TEMPERATURE,
        messages: [
          { role: "system", content: OPENAI_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: zodResponseFormat(ChaptersSchema, "chapters"),
      },
      { signal: opts.signal },
    )
  } catch (err) {
    log.error("OpenAI request failed", {
      ms: Date.now() - reqStart,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }

  log.info("OpenAI response received", {
    ms: Date.now() - reqStart,
    usage: completion.usage,
    finishReason: completion.choices[0]?.finish_reason,
    refusal: completion.choices[0]?.message.refusal,
  })

  const parsed = completion.choices[0]?.message.parsed
  if (!parsed) {
    log.error("OpenAI returned empty response", {
      refusal: completion.choices[0]?.message.refusal,
    })
    throw new Error("OpenAI вернул пустой ответ")
  }

  const chapters = parsed.chapters.map((c) => ({
    timestamp: normalizeTimestamp(c.timestamp, opts.durationMs),
    title: c.title.trim(),
  }))
  log.info("chapters parsed", { count: chapters.length })
  return chapters
}
