import { join } from 'path'
import { existsSync, readdirSync, statSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type {
  ArticleBundleSessionState
} from '../../../shared/articleBundleSessionTypes'
import { ARTICLE_BUNDLE_SESSION_LIMITS } from '../../../shared/articleBundleSessionTypes'
import {
  buildArticleBundleTempRoot,
  createArticleSessionTempDir,
  removeDirRecursive
} from './articleBundleSessionPathPolicy'

export type ArticleBundleFileRecord = {
  relativePath: string
  filePath: string
  bytes: number
}

export type ArticleBundleSessionRecord = {
  sessionId: string
  tempDir: string
  state: ArticleBundleSessionState
  startedAt: Date
  expiresAt: Date
  lastAppendAt: Date | null
  output: {
    markdownFilename: string
    targetFolderId: string | null
    duplicatePolicy: 'use_existing' | 'import_copy' | 'ask'
  }
  sourceMeta: {
    pageUrl: string | null
    pageTitle: string | null
  }
  options: {
    sessionTtlSeconds: number
    maxSessionBytes: number
    maxSingleFileBytes: number
    maxAssetFiles: number
  }
  files: ArticleBundleFileRecord[]
  sessionBytes: number
}

const sessions = new Map<string, ArticleBundleSessionRecord>()

function countCollectingSessions(): number {
  let n = 0
  for (const s of sessions.values()) {
    if (s.state === 'collecting' || s.state === 'finishing') n++
  }
  return n
}

export function releaseStaleSessionsBeforeStart(): void {
  purgeExpiredArticleBundleSessions()
  const now = Date.now()
  const finishStuckMs = ARTICLE_BUNDLE_SESSION_LIMITS.finishTimeoutMs + 60_000

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

  while (countCollectingSessions() >= ARTICLE_BUNDLE_SESSION_LIMITS.maxActiveSessions) {
    const active = [...sessions.values()].filter(
      (s) => s.state === 'collecting' || s.state === 'finishing'
    )
    if (!active.length) break
    active.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    abortSession(active[0]!.sessionId)
  }
}

export function createArticleBundleSession(input: {
  output: ArticleBundleSessionRecord['output']
  sourceMeta: ArticleBundleSessionRecord['sourceMeta']
  options: Partial<ArticleBundleSessionRecord['options']>
}): ArticleBundleSessionRecord {
  releaseStaleSessionsBeforeStart()
  if (countCollectingSessions() >= ARTICLE_BUNDLE_SESSION_LIMITS.maxActiveSessions) {
    throw new Error('ARTICLE_BUNDLE_SESSION_LIMIT')
  }

  const sessionId = `ab_${uuidv4()}`
  const tempDir = createArticleSessionTempDir(sessionId)
  const ttl = Math.max(60, input.options.sessionTtlSeconds ?? ARTICLE_BUNDLE_SESSION_LIMITS.defaultSessionTtlSeconds)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttl * 1000)

  const record: ArticleBundleSessionRecord = {
    sessionId,
    tempDir,
    state: 'collecting',
    startedAt: now,
    expiresAt,
    lastAppendAt: null,
    output: input.output,
    sourceMeta: input.sourceMeta,
    options: {
      sessionTtlSeconds: ttl,
      maxSessionBytes: input.options.maxSessionBytes ?? ARTICLE_BUNDLE_SESSION_LIMITS.maxSessionBytes,
      maxSingleFileBytes: input.options.maxSingleFileBytes ?? ARTICLE_BUNDLE_SESSION_LIMITS.maxSingleFileBytes,
      maxAssetFiles: input.options.maxAssetFiles ?? ARTICLE_BUNDLE_SESSION_LIMITS.maxAssetFiles
    },
    files: [],
    sessionBytes: 0
  }

  sessions.set(sessionId, record)
  return record
}

export function getArticleBundleSession(sessionId: string): ArticleBundleSessionRecord | null {
  const s = sessions.get(sessionId)
  if (!s) return null
  if (s.state === 'expired' || (s.expiresAt < new Date() && s.state === 'collecting')) {
    s.state = 'expired'
    return s
  }
  return s
}

export function touchSessionExpiry(session: ArticleBundleSessionRecord): void {
  const ttl = session.options.sessionTtlSeconds * 1000
  session.expiresAt = new Date(Date.now() + ttl)
}

export function appendArticleBundleFile(
  sessionId: string,
  file: ArticleBundleFileRecord
): ArticleBundleSessionRecord {
  const session = getArticleBundleSession(sessionId)
  if (!session) throw new Error('ARTICLE_BUNDLE_SESSION_NOT_FOUND')
  if (session.state !== 'collecting') {
    if (session.state === 'finishing') throw new Error('ARTICLE_BUNDLE_SESSION_BUSY')
    throw new Error('ARTICLE_BUNDLE_SESSION_NOT_FOUND')
  }
  if (session.expiresAt < new Date()) {
    session.state = 'expired'
    throw new Error('ARTICLE_BUNDLE_SESSION_EXPIRED')
  }
  if (session.files.length >= session.options.maxAssetFiles) {
    throw new Error('ARTICLE_BUNDLE_TOO_MANY_FILES')
  }
  if (file.bytes > session.options.maxSingleFileBytes) {
    throw new Error('ARTICLE_BUNDLE_FILE_TOO_LARGE')
  }
  if (session.sessionBytes + file.bytes > session.options.maxSessionBytes) {
    throw new Error('ARTICLE_BUNDLE_SESSION_TOO_LARGE')
  }

  // Replace if same relative path exists
  const existingIdx = session.files.findIndex(f => f.relativePath === file.relativePath)
  if (existingIdx >= 0) {
    session.sessionBytes -= session.files[existingIdx]!.bytes
    session.files[existingIdx] = file
  } else {
    session.files.push(file)
  }
  
  session.sessionBytes += file.bytes
  session.lastAppendAt = new Date()
  touchSessionExpiry(session)
  return session
}

export function beginFinish(sessionId: string): ArticleBundleSessionRecord {
  const session = getArticleBundleSession(sessionId)
  if (!session) throw new Error('ARTICLE_BUNDLE_SESSION_NOT_FOUND')
  if (session.state === 'finishing') throw new Error('ARTICLE_BUNDLE_SESSION_BUSY')
  if (session.state !== 'collecting') throw new Error('ARTICLE_BUNDLE_SESSION_NOT_FOUND')
  session.state = 'finishing'
  return session
}

export function endSession(
  sessionId: string,
  state: 'finished' | 'aborted'
): ArticleBundleSessionRecord | null {
  const session = sessions.get(sessionId)
  if (!session) return null
  session.state = state
  return session
}

export function deleteSession(sessionId: string): ArticleBundleSessionRecord | null {
  const session = sessions.get(sessionId)
  if (session) sessions.delete(sessionId)
  return session ?? null
}

export function abortSession(sessionId: string): { session: ArticleBundleSessionRecord | null; filesRemoved: number } {
  const session = deleteSession(sessionId)
  if (!session) {
    return { session: null, filesRemoved: 0 }
  }
  const filesRemoved = removeDirRecursive(session.tempDir)
  session.state = 'aborted'
  return { session, filesRemoved }
}

export function purgeExpiredArticleBundleSessions(): number {
  const now = new Date()
  let removed = 0
  for (const [id, session] of [...sessions.entries()]) {
    if (session.state === 'finishing') continue
    if (session.expiresAt < now) {
      abortSession(id)
      removed++
    }
  }
  const root = buildArticleBundleTempRoot()
  try {
    if (!existsSync(root)) return removed
    for (const name of readdirSync(root)) {
      if (!name.startsWith('ab_')) continue
      const dir = join(root, name)
      try {
        const st = statSync(dir)
        if (!st.isDirectory()) continue
      } catch {
        continue
      }
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
    maxAssetFiles: ARTICLE_BUNDLE_SESSION_LIMITS.maxAssetFiles,
    maxSingleFileBytes: ARTICLE_BUNDLE_SESSION_LIMITS.maxSingleFileBytes,
    maxSessionBytes: ARTICLE_BUNDLE_SESSION_LIMITS.maxSessionBytes,
    appendTimeoutMs: ARTICLE_BUNDLE_SESSION_LIMITS.appendTimeoutMs,
    finishTimeoutMs: ARTICLE_BUNDLE_SESSION_LIMITS.finishTimeoutMs
  }
}
