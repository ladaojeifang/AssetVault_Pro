import { join } from 'path'
import { existsSync, readdirSync, statSync } from 'fs'
import type {
  FullPageOutputFormat,
  FullPageSessionState,
  FullPageWarningCode
} from '@/shared/fullPageSessionTypes'
import { FULLPAGE_SESSION_LIMITS } from '@/shared/fullPageSessionTypes'
import {
  buildFullPageTempRoot,
  createSessionTempDir,
  dirHasStripFiles,
  isPreservedSessionDir,
  markSessionDirPreserved,
  removeDirRecursive
} from './fullPageSessionPathPolicy'

export type FullPageStripRecord = {
  stripIndex: number
  filePath: string
  widthPx: number
  stripHeightPx: number
  bytes: number
}

export type FullPageSessionRecord = {
  sessionId: string
  tempDir: string
  state: FullPageSessionState
  startedAt: Date
  expiresAt: Date
  lastAppendAt: Date | null
  layout: {
    widthPx: number
    contentHeightPx: number
    stripHeightsPx: number[]
    overlapPx: number
    devicePixelRatio: number
  }
  output: {
    filename: string
    format: FullPageOutputFormat
    quality: number
    targetFolderId: string | null
    duplicatePolicy: 'use_existing' | 'import_copy' | 'ask'
  }
  sourceMeta: {
    pageUrl: string | null
    pageTitle: string | null
  }
  options: {
    maxOutputPixels: number
    maxOutputSide: number
    maxOutputBytes: number
    sessionTtlSeconds: number
  }
  strips: FullPageStripRecord[]
  sessionBytes: number
}

const sessions = new Map<string, FullPageSessionRecord>()

function countCollectingSessions(): number {
  let n = 0
  for (const s of sessions.values()) {
    if (s.state === 'collecting' || s.state === 'finishing') n++
  }
  return n
}

/** Free slots before a new start (stuck finishing / expired / over limit). */
export function releaseStaleSessionsBeforeStart(): void {
  purgeExpiredFullPageSessions()
  const now = Date.now()
  const finishStuckMs = FULLPAGE_SESSION_LIMITS.finishTimeoutMs + 60_000

  for (const [id, session] of [...sessions.entries()]) {
    if (session.state === 'finishing') {
      const lastMs = (session.lastAppendAt ?? session.startedAt).getTime()
      if (now - lastMs > finishStuckMs || session.expiresAt < new Date()) {
        abortSession(id)
      }
    }
    if (session.state === 'expired' || session.state === 'finished' || session.state === 'aborted') {
      deleteSession(id)
    }
  }

  while (countCollectingSessions() >= FULLPAGE_SESSION_LIMITS.maxActiveSessions) {
    const active = [...sessions.values()].filter(
      (s) => s.state === 'collecting' || s.state === 'finishing'
    )
    if (!active.length) break
    active.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    abortSession(active[0]!.sessionId)
  }
}

export function createFullPageSession(input: {
  layout: FullPageSessionRecord['layout']
  output: FullPageSessionRecord['output']
  sourceMeta: FullPageSessionRecord['sourceMeta']
  options: Partial<FullPageSessionRecord['options']> & { sessionId?: string }
}): FullPageSessionRecord {
  releaseStaleSessionsBeforeStart()
  if (countCollectingSessions() >= FULLPAGE_SESSION_LIMITS.maxActiveSessions) {
    throw new Error('FULLPAGE_SESSION_LIMIT')
  }

  const sessionId =
    typeof input.options.sessionId === 'string' && /^inspect-\d+$/.test(input.options.sessionId)
      ? input.options.sessionId
      : `inspect-${Date.now()}`
  const tempDir = createSessionTempDir(sessionId)
  const ttl = Math.max(60, input.options.sessionTtlSeconds ?? FULLPAGE_SESSION_LIMITS.defaultSessionTtlSeconds)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttl * 1000)

  const record: FullPageSessionRecord = {
    sessionId,
    tempDir,
    state: 'collecting',
    startedAt: now,
    expiresAt,
    lastAppendAt: null,
    layout: input.layout,
    output: input.output,
    sourceMeta: input.sourceMeta,
    options: {
      maxOutputPixels:
        input.options.maxOutputPixels ?? FULLPAGE_SESSION_LIMITS.defaultMaxOutputPixels,
      maxOutputSide: input.options.maxOutputSide ?? FULLPAGE_SESSION_LIMITS.defaultMaxOutputSide,
      maxOutputBytes: input.options.maxOutputBytes ?? FULLPAGE_SESSION_LIMITS.maxOutputBytes,
      sessionTtlSeconds: ttl
    },
    strips: [],
    sessionBytes: 0
  }

  sessions.set(sessionId, record)
  return record
}

export function getFullPageSession(sessionId: string): FullPageSessionRecord | null {
  const s = sessions.get(sessionId)
  if (!s) return null
  if (s.state === 'expired' || (s.expiresAt < new Date() && s.state === 'collecting')) {
    s.state = 'expired'
    return s
  }
  return s
}

export function touchSessionExpiry(session: FullPageSessionRecord): void {
  const ttl = session.options.sessionTtlSeconds * 1000
  session.expiresAt = new Date(Date.now() + ttl)
}

export function appendFullPageStrip(
  sessionId: string,
  strip: Omit<FullPageStripRecord, 'bytes'> & { bytes: number }
): FullPageSessionRecord {
  const session = getFullPageSession(sessionId)
  if (!session) throw new Error('FULLPAGE_SESSION_NOT_FOUND')
  if (session.state !== 'collecting') {
    if (session.state === 'finishing') throw new Error('FULLPAGE_SESSION_BUSY')
    throw new Error('FULLPAGE_SESSION_NOT_FOUND')
  }
  if (session.expiresAt < new Date()) {
    session.state = 'expired'
    throw new Error('FULLPAGE_SESSION_EXPIRED')
  }
  if (session.strips.length >= FULLPAGE_SESSION_LIMITS.maxStrips) {
    throw new Error('FULLPAGE_STRIP_TOO_LARGE')
  }
  if (strip.stripIndex !== session.strips.length) {
    throw new Error('FULLPAGE_STRIP_ORDER')
  }
  if (strip.bytes > FULLPAGE_SESSION_LIMITS.maxStripBytes) {
    throw new Error('FULLPAGE_STRIP_TOO_LARGE')
  }
  if (session.sessionBytes + strip.bytes > FULLPAGE_SESSION_LIMITS.maxSessionBytes) {
    throw new Error('FULLPAGE_STRIP_TOO_LARGE')
  }

  session.strips.push(strip)
  session.sessionBytes += strip.bytes
  session.lastAppendAt = new Date()
  touchSessionExpiry(session)
  return session
}

export function beginFinish(sessionId: string): FullPageSessionRecord {
  const session = getFullPageSession(sessionId)
  if (!session) throw new Error('FULLPAGE_SESSION_NOT_FOUND')
  if (session.state === 'finishing') throw new Error('FULLPAGE_SESSION_BUSY')
  if (session.state !== 'collecting') throw new Error('FULLPAGE_SESSION_NOT_FOUND')
  if (session.strips.length === 0) throw new Error('FULLPAGE_SESSION_EMPTY')
  session.state = 'finishing'
  return session
}

export function endSession(
  sessionId: string,
  state: 'finished' | 'aborted'
): FullPageSessionRecord | null {
  const session = sessions.get(sessionId)
  if (!session) return null
  session.state = state
  return session
}

export function deleteSession(sessionId: string): FullPageSessionRecord | null {
  const session = sessions.get(sessionId)
  if (session) sessions.delete(sessionId)
  return session ?? null
}

export function abortSession(sessionId: string): { session: FullPageSessionRecord | null; filesRemoved: number } {
  const session = deleteSession(sessionId)
  if (!session) {
    return { session: null, filesRemoved: 0 }
  }
  let filesRemoved = 0
  if (!isPreservedSessionDir(session.tempDir) && !dirHasStripFiles(session.tempDir)) {
    filesRemoved = removeDirRecursive(session.tempDir)
  } else {
    markSessionDirPreserved(session.tempDir, { sessionId, aborted: true })
  }
  session.state = 'aborted'
  return { session, filesRemoved }
}

export function purgeExpiredFullPageSessions(): number {
  const now = new Date()
  let removed = 0
  for (const [id, session] of [...sessions.entries()]) {
    if (session.state === 'finishing') {
      if (session.expiresAt < now) {
        abortSession(id)
        removed++
      }
      continue
    }
    if (session.expiresAt < now) {
      if (isPreservedSessionDir(session.tempDir)) {
        deleteSession(id)
      } else {
        abortSession(id)
      }
      removed++
    }
  }
  const root = buildFullPageTempRoot()
  try {
    if (!existsSync(root)) return removed
    for (const name of readdirSync(root)) {
      if (
        name.startsWith('inspect-') ||
        name.startsWith('kept-') ||
        name.startsWith('_kept') ||
        name.startsWith('debug-')
      ) {
        continue
      }
      if (!name.startsWith('inspect-') && !name.startsWith('fp_')) continue
      const dir = join(root, name)
      try {
        const st = statSync(dir)
        if (!st.isDirectory()) continue
      } catch {
        continue
      }
      if (isPreservedSessionDir(dir)) continue
      if (dirHasStripFiles(dir)) continue
      if (!sessions.has(name)) {
        removeDirRecursive(dir)
        removed++
      }
    }
  } catch {
    /* ignore */
  }
  return removed
}

export function sessionLimitsPayload() {
  return {
    maxStrips: FULLPAGE_SESSION_LIMITS.maxStrips,
    maxStripBytes: FULLPAGE_SESSION_LIMITS.maxStripBytes,
    maxSessionBytes: FULLPAGE_SESSION_LIMITS.maxSessionBytes,
    appendTimeoutMs: FULLPAGE_SESSION_LIMITS.appendTimeoutMs,
    finishTimeoutMs: FULLPAGE_SESSION_LIMITS.finishTimeoutMs
  }
}

export function clearAllSessionsForTests(): void {
  sessions.clear()
}
