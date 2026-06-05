import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { PageVideoJobRecord } from './pageVideoImportStore'

type SerializedJob = Omit<PageVideoJobRecord, 'ytdlpCancel' | 'createdAt' | 'startedAt' | 'updatedAt' | 'completedAt'> & {
  createdAt: string
  startedAt: string | null
  updatedAt: string
  completedAt: string | null
}

type PersistedSnapshot = {
  version: 1
  jobs: SerializedJob[]
}

function jobsFilePath(): string {
  return join(app.getPath('userData'), 'AssetVault', 'page-video-jobs.json')
}

function serializeJob(j: PageVideoJobRecord): SerializedJob {
  const { ytdlpCancel: _c, createdAt, startedAt, updatedAt, completedAt, ...rest } = j
  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    startedAt: startedAt?.toISOString() ?? null,
    updatedAt: updatedAt.toISOString(),
    completedAt: completedAt?.toISOString() ?? null
  }
}

function deserializeJob(s: SerializedJob): PageVideoJobRecord {
  return {
    ...s,
    createdAt: new Date(s.createdAt),
    startedAt: s.startedAt ? new Date(s.startedAt) : null,
    updatedAt: new Date(s.updatedAt),
    completedAt: s.completedAt ? new Date(s.completedAt) : null,
    cancelRequested: Boolean(s.cancelRequested)
  }
}

export function loadPersistedPageVideoJobs(): PageVideoJobRecord[] {
  const path = jobsFilePath()
  if (!existsSync(path)) return []
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as PersistedSnapshot
    if (parsed?.version !== 1 || !Array.isArray(parsed.jobs)) return []
    return parsed.jobs.map(deserializeJob)
  } catch {
    return []
  }
}

export function savePersistedPageVideoJobs(jobs: Iterable<PageVideoJobRecord>): void {
  const path = jobsFilePath()
  mkdirSync(join(app.getPath('userData'), 'AssetVault'), { recursive: true })
  const snapshot: PersistedSnapshot = {
    version: 1,
    jobs: [...jobs].map(serializeJob)
  }
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(snapshot), 'utf8')
  renameSync(tmp, path)
}
