import { EventEmitter } from "node:events"
import type { JobEvent, JobState, Stage } from "./types"

type GlobalJobStore = {
  jobs: Map<string, JobState>
  emitter: EventEmitter
}

const g = globalThis as unknown as { __timecodesStore?: GlobalJobStore }

function getStore(): GlobalJobStore {
  if (!g.__timecodesStore) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(100)
    g.__timecodesStore = { jobs: new Map(), emitter }
  }
  return g.__timecodesStore
}

export function createJob(initial: Omit<JobState, "createdAt" | "progress">): JobState {
  const store = getStore()
  const state: JobState = { ...initial, createdAt: Date.now(), progress: 0 }
  store.jobs.set(state.id, state)
  return state
}

export function getJob(id: string): JobState | undefined {
  return getStore().jobs.get(id)
}

export function setStage(id: string, stage: Stage, subStatus?: string) {
  const store = getStore()
  const job = store.jobs.get(id)
  if (!job) return
  job.stage = stage
  job.progress = 0
  job.subStatus = subStatus
  emit(id, { type: "stage", stage, subStatus })
}

export function setProgress(id: string, progress: number, subStatus?: string) {
  const store = getStore()
  const job = store.jobs.get(id)
  if (!job) return
  job.progress = Math.max(0, Math.min(100, progress))
  if (subStatus !== undefined) job.subStatus = subStatus
  emit(id, { type: "progress", progress: job.progress, subStatus })
}

export function completeJob(id: string, chapters: JobState["chapters"], durationSec?: number) {
  const store = getStore()
  const job = store.jobs.get(id)
  if (!job) return
  job.stage = "done"
  job.progress = 100
  job.chapters = chapters
  job.durationSec = durationSec
  job.subStatus = undefined
  emit(id, { type: "done", chapters: chapters ?? [], durationSec })
}

export function failJob(id: string, error: string) {
  const store = getStore()
  const job = store.jobs.get(id)
  if (!job) return
  job.error = error
  emit(id, { type: "error", error })
}

function emit(id: string, event: JobEvent) {
  getStore().emitter.emit(id, event)
}

export function subscribe(id: string, handler: (event: JobEvent) => void): () => void {
  const store = getStore()
  store.emitter.on(id, handler)
  return () => {
    store.emitter.off(id, handler)
  }
}

export function sweepOldJobs(maxAgeMs = 24 * 60 * 60 * 1000) {
  const store = getStore()
  const now = Date.now()
  for (const [id, job] of store.jobs.entries()) {
    if (now - job.createdAt > maxAgeMs) store.jobs.delete(id)
  }
}
