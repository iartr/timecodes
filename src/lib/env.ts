import { z } from "zod"

const DEFAULT_PROMPT = `Ты редактор и аналитик видео. На основе расшифровки подготовь полезный структурированный разбор на русском языке.

Цель: зритель должен быстро понять, что обсуждалось, где находятся важные части видео и на какие моменты стоит обратить внимание.

Требования:
- Сформулируй саммари на 3-5 содержательных предложений.
- Сгенерируй 5-15 таймкодов глав; первая глава должна начинаться с 00:00 или 00:00:00.
- Для каждой главы дай конкретное название и одно предложение, объясняющее, что обсуждалось в этом фрагменте.
- Сгенерируй 3-8 интересных топиков с таймкодами и объяснением, почему момент важен; если материала мало, верни меньше, но не выдумывай.
- Используй таймкоды только из расшифровки или близкие к ним по смыслу.
- Не добавляй факты, которых нет в расшифровке.
- Не нумеруй текст внутри полей.`

const schema = z.object({
  ASSEMBLYAI_API_KEY: z.string().min(1, "ASSEMBLYAI_API_KEY is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().default("gpt-5.5"),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),
  OPENAI_SYSTEM_PROMPT: z.string().default(DEFAULT_PROMPT),
  YTDLP_PATH: z.string().optional(),
  YTDLP_COOKIES_FROM_BROWSER: z.string().optional(),
  YTDLP_COOKIES_FILE: z.string().optional(),
  YTDLP_COOKIES_CONTENT: z.string().optional(),
  YTDLP_EXTRA_ARGS: z.string().optional(),
  FFMPEG_PATH: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(2048),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
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
