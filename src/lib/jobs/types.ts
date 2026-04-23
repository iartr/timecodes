export type Stage =
  | "queued"
  | "source"
  | "audio"
  | "transcribe"
  | "chapters"
  | "done"
  | "error"

export type SourceKind = "upload" | "youtube" | "yadisk" | "gdrive" | "generic"

export interface Chapter {
  timestamp: string
  title: string
}

export interface JobState {
  id: string
  createdAt: number
  stage: Stage
  progress: number
  sourceKind: SourceKind
  sourceLabel: string
  subStatus?: string
  chapters?: Chapter[]
  durationSec?: number
  error?: string
}

export type JobEvent =
  | { type: "snapshot"; state: JobState }
  | { type: "stage"; stage: Stage; subStatus?: string }
  | { type: "progress"; progress: number; subStatus?: string }
  | { type: "done"; chapters: Chapter[]; durationSec?: number }
  | { type: "error"; error: string }
  | { type: "ping" }
