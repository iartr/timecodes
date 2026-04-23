import { z } from "zod"

const DEFAULT_PROMPT = `Ты редактор YouTube. На основе расшифровки сгенерируй от 5 до 15 таймкодов глав видео. Первая глава должна быть в 00:00. Каждая глава — краткое (2-6 слов), информативное название. Без нумерации, без вступлений и заключений. Используй формат HH:MM:SS только если видео длиннее часа, иначе MM:SS.`

const schema = z.object({
  ASSEMBLYAI_API_KEY: z.string().min(1, "ASSEMBLYAI_API_KEY is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),
  OPENAI_SYSTEM_PROMPT: z.string().default(DEFAULT_PROMPT),
  YTDLP_PATH: z.string().optional(),
  YTDLP_COOKIES_FROM_BROWSER: z.string().optional(),
  FFMPEG_PATH: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(2048),
})

let cached: z.infer<typeof schema> | null = null

export function env() {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ")
    throw new Error(`Invalid environment configuration:\n  ${msg}`)
  }
  cached = parsed.data
  return cached
}
