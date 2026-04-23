# Timecodes

Веб-сервис для автоматической генерации таймкодов (глав) видео.

1. Загрузите видео файлом или вставьте ссылку (YouTube, Яндекс.Диск, Google Drive, или любая ссылка, поддерживаемая yt-dlp).
2. Сервис извлекает аудио, отправляет в AssemblyAI для транскрипции, затем в OpenAI для генерации глав.
3. Получаете готовый список таймкодов с кнопкой «Копировать всё».

## Стек

- Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- AssemblyAI — транскрипция со словными таймстемпами
- OpenAI Structured Outputs — генерация глав (настраиваемая модель и промпт)
- yt-dlp + ffmpeg — источники и извлечение аудио

## Локальный запуск

```bash
cp .env.example .env.local  # задайте ASSEMBLYAI_API_KEY и OPENAI_API_KEY
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Требования: `ffmpeg` и `yt-dlp` в PATH (или задайте `FFMPEG_PATH` / `YTDLP_PATH`).

## Переменные окружения

| Переменная | Обяз. | Описание |
|---|---|---|
| `ASSEMBLYAI_API_KEY` | да | Ключ [AssemblyAI](https://www.assemblyai.com/app/api-keys) |
| `OPENAI_API_KEY` | да | Ключ [OpenAI](https://platform.openai.com/api-keys) |
| `OPENAI_MODEL` | — | Модель для генерации глав. Default: `gpt-4o-mini` |
| `OPENAI_TEMPERATURE` | — | 0–2, default `0.3` |
| `OPENAI_SYSTEM_PROMPT` | — | Системный промпт (есть разумный русский default) |
| `YTDLP_PATH` | — | Абсолютный путь к `yt-dlp` (если не в PATH) |
| `YTDLP_COOKIES_FROM_BROWSER` | — | `chrome` / `firefox` / `safari` — для age-gated YouTube |
| `FFMPEG_PATH` | — | Абсолютный путь к `ffmpeg` (если не в PATH) |
| `MAX_UPLOAD_MB` | — | Лимит размера загружаемого файла, default `2048` |

## Деплой на Railway

```bash
railway up
```

Railway подхватит `Dockerfile` (multi-stage, внутри образа уже установлены `ffmpeg` и `yt-dlp`). Задайте переменные окружения через Railway UI.

Конфиг: один инстанс (`numReplicas: 1`) — in-memory job store не делится между репликами.

## Ограничения

- Транскрипция длинных видео занимает время: ~20–40% от длительности аудио на стороне AssemblyAI.
- Для приватных / age-gated YouTube-видео укажите `YTDLP_COOKIES_FROM_BROWSER`.
- При перезапуске сервера состояние незавершённых задач теряется (in-memory).
