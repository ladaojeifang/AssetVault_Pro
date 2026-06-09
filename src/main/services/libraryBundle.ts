import { join, relative, sep, isAbsolute, normalize, basename } from 'path'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  renameSync,
  unlinkSync,
  realpathSync
} from 'fs'
import type { LibraryMode } from '@/shared/libraryTypes'
import { loadLibraryModeFromManifest, writeLibraryManifest } from './libraryManifest'

const ACTIVE_LIBRARY_JSON = 'active-library.json'
export const LIBRARY_DB_NAME = 'library.sqlite'
export const MANIFEST_NAME = 'manifest.json'
export const ITEMS_DIR = 'items'

const MAX_RECENT = 20

export interface LibraryUserState {
  activeLibraryRoot: string
  recentLibraries: string[]
}

let libraryRootResolved = ''

export function getLibraryRoot(): string {
  if (!libraryRootResolved) {
    throw new Error('[Library] Library root not initialized (prepareOnStartup not run)')
  }
  return libraryRootResolved
}

export function setLibraryRootForSession(root: string): void {
  libraryRootResolved = normalize(root.trim())
}

export function isLibraryReady(): boolean {
  return Boolean(libraryRootResolved)
}

function normalizeRoot(p: string): string {
  return normalize(p.trim())
}

/** Case-insensitive dedup key; resolves symlinks / short vs long paths when the folder exists. */
export function libraryPathKey(p: string): string {
  const trimmed = p.trim()
  if (!trimmed) return ''
  try {
    if (existsSync(trimmed)) {
      return normalize(realpathSync.native(trimmed)).toLowerCase()
    }
  } catch {
    /* fall through */
  }
  return normalizeRoot(trimmed).toLowerCase()
}

function dedupeLibraryRoots(paths: string[]): string[] {
  const uniq: string[] = []
  const seen = new Set<string>()
  for (const r of paths) {
    const n = normalizeRoot(r)
    if (!n) continue
    const k = libraryPathKey(n)
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(n)
    if (uniq.length >= MAX_RECENT) break
  }
  return uniq
}

/**
 * Read persisted library selection + recent list. Supports legacy `{ libraryRoot }` file.
 */
export function readLibraryUserState(userData: string): LibraryUserState | null {
  const p = join(userData, ACTIVE_LIBRARY_JSON)
  if (!existsSync(p)) return null
  try {
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>

    if (typeof raw.libraryRoot === 'string' && typeof raw.activeLibraryRoot !== 'string') {
      const root = normalizeRoot(raw.libraryRoot)
      return { activeLibraryRoot: root, recentLibraries: [root] }
    }

    if (typeof raw.activeLibraryRoot === 'string') {
      const active = normalizeRoot(raw.activeLibraryRoot)
      const recentRaw = Array.isArray(raw.recentLibraries)
        ? (raw.recentLibraries as unknown[]).filter((x): x is string => typeof x === 'string')
        : []
      const recent = recentRaw.map(normalizeRoot).filter(Boolean)
      const merged = [active, ...recent.filter((r) => libraryPathKey(r) !== libraryPathKey(active))]
      return { activeLibraryRoot: active, recentLibraries: dedupeLibraryRoots(merged) }
    }

    return null
  } catch {
    return null
  }
}

export function writeLibraryUserState(userData: string, state: LibraryUserState): void {
  const p = join(userData, ACTIVE_LIBRARY_JSON)
  const active = normalizeRoot(state.activeLibraryRoot)
  const merged = [
    active,
    ...state.recentLibraries
      .map(normalizeRoot)
      .filter((r) => r && libraryPathKey(r) !== libraryPathKey(active))
  ]
  const body: LibraryUserState = { activeLibraryRoot: active, recentLibraries: dedupeLibraryRoots(merged) }
  const payload = JSON.stringify(body, null, 2)
  const tmp = join(userData, `${ACTIVE_LIBRARY_JSON}.${process.pid}.tmp`)
  try {
    writeFileSync(tmp, payload, 'utf-8')
    renameSync(tmp, p)
  } catch (e) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    throw e
  }
}

export function buildStateAfterSwitch(userData: string, newActiveRoot: string): LibraryUserState {
  const prev = readLibraryUserState(userData)
  const active = normalizeRoot(newActiveRoot)
  const prevRecent = prev?.recentLibraries ?? []
  const prevActive = prev?.activeLibraryRoot ? normalizeRoot(prev.activeLibraryRoot) : null

  /** Preserve previous active root in recents (even if missing from recentLibraries), so unplugged drives / dev restarts do not erase the last path. */
  const merged: string[] = [active]
  const seen = new Set<string>([libraryPathKey(active)])
  if (prevActive && !seen.has(libraryPathKey(prevActive))) {
    merged.push(prevActive)
    seen.add(libraryPathKey(prevActive))
  }
  for (const r of prevRecent) {
    const n = normalizeRoot(r)
    const k = libraryPathKey(n)
    if (!n || seen.has(k)) continue
    seen.add(k)
    merged.push(n)
  }

  return { activeLibraryRoot: active, recentLibraries: dedupeLibraryRoots(merged) }
}

export function removeFromRecentList(userData: string, pathToRemove: string): LibraryUserState {
  const prev = readLibraryUserState(userData)
  if (!prev) {
    throw new Error('无法读取资料库列表')
  }
  const targetKey = libraryPathKey(pathToRemove)
  if (!targetKey) {
    throw new Error('无效路径')
  }
  if (libraryPathKey(prev.activeLibraryRoot) === targetKey) {
    throw new Error('无法从列表移除当前正在使用的资料库，请先切换到其他资料库')
  }
  const beforeLen = prev.recentLibraries.length
  const filtered = prev.recentLibraries.filter((r) => libraryPathKey(r) !== targetKey)
  if (filtered.length === beforeLen) {
    throw new Error('该资料库不在最近列表中')
  }
  const nextRecent = [
    prev.activeLibraryRoot,
    ...filtered.filter((r) => libraryPathKey(r) !== libraryPathKey(prev.activeLibraryRoot))
  ]
  const next: LibraryUserState = {
    activeLibraryRoot: prev.activeLibraryRoot,
    recentLibraries: dedupeLibraryRoots(nextRecent)
  }
  writeLibraryUserState(userData, next)
  return next
}

function defaultLibraryRoot(userData: string): string {
  return join(userData, 'AssetVault.library')
}

export function ensureLibraryDirectories(root: string): void {
  mkdirSync(join(root, ITEMS_DIR), { recursive: true })
}

export function ensureManifest(root: string, options?: { libraryMode?: LibraryMode; displayName?: string }): void {
  const mf = join(root, MANIFEST_NAME)
  if (existsSync(mf)) {
    loadLibraryModeFromManifest(root)
    return
  }
  writeLibraryManifest(root, {
    formatVersion: '1.1',
    displayName: options?.displayName ?? 'AssetVault Library',
    libraryMode: options?.libraryMode ?? 'archive'
  })
}

export { getLibraryMode, loadLibraryModeFromManifest, readLibraryManifestFile, writeLibraryManifest } from './libraryManifest'

/**
 * Resolve a DB-stored path to an absolute path on disk.
 * Legacy rows keep absolute paths; bundle rows use forward-slash paths relative to library root.
 */
export function resolveLibraryPath(storedPath: string): string {
  const s = storedPath.trim()
  if (!s) return s
  if (isAbsolute(s)) return normalize(s)
  return normalize(join(libraryRootResolved, s.split('/').join(sep)))
}

export function isStoredPathRelativeToLibrary(storedPath: string): boolean {
  return Boolean(storedPath) && !isAbsolute(storedPath.trim())
}

export function itemDirAbsolute(assetId: string): string {
  return join(libraryRootResolved, ITEMS_DIR, assetId)
}

const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

/** Safe on-disk name inside items/{id}/ — keeps the user's original basename when possible. */
export function sanitizeStorageFileName(originalName: string): string {
  let name = basename(originalName.trim())
  name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  name = name.replace(/[.\s]+$/g, '')
  if (!name) name = 'Untitled'

  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let stemSafe = stem.trim() || 'Untitled'
  if (WIN_RESERVED.test(stemSafe)) stemSafe = `_${stemSafe}`
  return `${stemSafe}${ext}`
}

/** Relative path to the asset's original file under the library root (forward slashes). */
export function itemPackFileRelative(assetId: string, storageFileName: string): string {
  return `${ITEMS_DIR}/${assetId}/${sanitizeStorageFileName(storageFileName)}`
}

/** @deprecated Prefer itemPackFileRelative with the real file name. */
export function itemOriginalRelative(assetId: string, extensionWithoutDot: string): string {
  return itemPackFileRelative(assetId, `original.${extensionWithoutDot.toLowerCase()}`)
}

export function itemThumbRelative(assetId: string): string {
  return `${ITEMS_DIR}/${assetId}/thumb.webp`
}

export function removeItemPack(assetId: string): void {
  const dir = itemDirAbsolute(assetId)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Pick library root + DB path on app startup. Persists `active-library.json` when creating default or migrating legacy DB.
 */
export function prepareOnStartup(userData: string): { libraryRoot: string; dbPath: string } {
  const legacyDb = join(userData, 'assetvault.db')
  const state = readLibraryUserState(userData)

  const candidates: string[] = []
  const seenCand = new Set<string>()
  const pushCand = (p?: string | null) => {
    if (typeof p !== 'string' || !p.trim()) return
    const n = normalizeRoot(p)
    const k = libraryPathKey(n)
    if (!k || seenCand.has(k)) return
    seenCand.add(k)
    candidates.push(n)
  }
  if (state) {
    pushCand(state.activeLibraryRoot)
    for (const r of state.recentLibraries ?? []) pushCand(r)
  }

  let root: string | undefined
  for (const cand of candidates) {
    if (existsSync(cand)) {
      root = cand
      break
    }
  }

  if (!root) {
    root = normalize(defaultLibraryRoot(userData))
    mkdirSync(root, { recursive: true })
    ensureLibraryDirectories(root)
    ensureManifest(root)
    const newDb = join(root, LIBRARY_DB_NAME)
    if (!existsSync(newDb) && existsSync(legacyDb)) {
      copyFileSync(legacyDb, newDb)
      console.log('[Library] Copied legacy assetvault.db →', newDb)
    }
    const newState = buildStateAfterSwitch(userData, root)
    writeLibraryUserState(userData, newState)
  } else if (state && normalizeRoot(state.activeLibraryRoot) !== normalizeRoot(root)) {
    writeLibraryUserState(userData, buildStateAfterSwitch(userData, root))
    console.log('[Library] Active path missing; opened first available library from recents:', root)
  }

  libraryRootResolved = root
  ensureLibraryDirectories(root)
  ensureManifest(root)
  loadLibraryModeFromManifest(root)

  return { libraryRoot: root, dbPath: join(root, LIBRARY_DB_NAME) }
}

export function toLibraryRelativeIfUnderRoot(absolutePath: string): string | null {
  const abs = normalize(absolutePath)
  const root = normalize(libraryRootResolved)
  const rel = relative(root, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  return rel.split(sep).join('/')
}
