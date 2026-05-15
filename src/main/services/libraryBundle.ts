import { join, relative, sep, isAbsolute, normalize, basename } from 'path'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  renameSync,
  unlinkSync
} from 'fs'
import { v4 as uuidv4 } from 'uuid'

const ACTIVE_LIBRARY_JSON = 'active-library.json'
export const LIBRARY_DB_NAME = 'library.sqlite'
const MANIFEST_NAME = 'manifest.json'
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
      const merged = [active, ...recent.filter((r) => r.toLowerCase() !== active.toLowerCase())]
      const uniq: string[] = []
      const seen = new Set<string>()
      for (const r of merged) {
        const k = r.toLowerCase()
        if (seen.has(k)) continue
        seen.add(k)
        uniq.push(r)
        if (uniq.length >= MAX_RECENT) break
      }
      return { activeLibraryRoot: active, recentLibraries: uniq }
    }

    return null
  } catch {
    return null
  }
}

export function writeLibraryUserState(userData: string, state: LibraryUserState): void {
  const p = join(userData, ACTIVE_LIBRARY_JSON)
  const active = normalizeRoot(state.activeLibraryRoot)
  const merged = [active, ...state.recentLibraries.map(normalizeRoot).filter((r) => r.toLowerCase() !== active.toLowerCase())]
  const uniq: string[] = []
  const seen = new Set<string>()
  for (const r of merged) {
    const k = r.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(r)
    if (uniq.length >= MAX_RECENT) break
  }
  const body: LibraryUserState = { activeLibraryRoot: active, recentLibraries: uniq }
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
  const seen = new Set<string>([active.toLowerCase()])
  if (prevActive && !seen.has(prevActive.toLowerCase())) {
    merged.push(prevActive)
    seen.add(prevActive.toLowerCase())
  }
  for (const r of prevRecent) {
    const n = normalizeRoot(r)
    const k = n.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(n)
  }

  const uniq: string[] = []
  seen.clear()
  for (const r of merged) {
    const k = r.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(r)
    if (uniq.length >= MAX_RECENT) break
  }
  return { activeLibraryRoot: active, recentLibraries: uniq }
}

export function removeFromRecentList(userData: string, pathToRemove: string): LibraryUserState | null {
  const prev = readLibraryUserState(userData)
  if (!prev) return null
  const target = normalizeRoot(pathToRemove)
  if (target.toLowerCase() === prev.activeLibraryRoot.toLowerCase()) {
    throw new Error('无法从列表移除当前正在使用的资料库，请先切换到其他资料库')
  }
  const filtered = prev.recentLibraries.filter((r) => r.toLowerCase() !== target.toLowerCase())
  const nextRecent = [
    prev.activeLibraryRoot,
    ...filtered.filter((r) => r.toLowerCase() !== prev.activeLibraryRoot.toLowerCase())
  ]
  const uniq: string[] = []
  const seen = new Set<string>()
  for (const r of nextRecent) {
    const k = r.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(r)
    if (uniq.length >= MAX_RECENT) break
  }
  const next: LibraryUserState = { activeLibraryRoot: prev.activeLibraryRoot, recentLibraries: uniq }
  writeLibraryUserState(userData, next)
  return next
}

function defaultLibraryRoot(userData: string): string {
  return join(userData, 'AssetVault.library')
}

export function ensureLibraryDirectories(root: string): void {
  mkdirSync(join(root, ITEMS_DIR), { recursive: true })
}

export function ensureManifest(root: string): void {
  const mf = join(root, MANIFEST_NAME)
  if (existsSync(mf)) return
  const now = new Date().toISOString()
  const manifest = {
    formatVersion: '1.0',
    appId: 'com.assetvault.library',
    libraryId: uuidv4(),
    displayName: 'AssetVault Library',
    createdAt: now,
    updatedAt: now
  }
  writeFileSync(mf, JSON.stringify(manifest, null, 2), 'utf-8')
}

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
    const k = n.toLowerCase()
    if (seenCand.has(k)) return
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

  return { libraryRoot: root, dbPath: join(root, LIBRARY_DB_NAME) }
}

export function toLibraryRelativeIfUnderRoot(absolutePath: string): string | null {
  const abs = normalize(absolutePath)
  const root = normalize(libraryRootResolved)
  const rel = relative(root, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  return rel.split(sep).join('/')
}
