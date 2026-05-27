import { app } from 'electron'
import { join, basename } from 'path'
import { existsSync, readFileSync } from 'fs'
import {
  getLibraryRoot,
  LIBRARY_DB_NAME,
  readLibraryUserState
} from './libraryBundle'
import { getLibraryMode, readLibraryManifestFile } from './libraryManifest'
import { getLibraryModeStats } from './libraryUpgrade'
import type { LibraryInfoResponse, LibraryStateResponse } from '@/shared/webApiTypes'

function readLibraryDisplayName(root: string): string {
  const mf = join(root, 'manifest.json')
  if (!existsSync(mf)) return basename(root)
  try {
    const j = JSON.parse(readFileSync(mf, 'utf-8')) as { displayName?: unknown }
    if (typeof j.displayName === 'string' && j.displayName.trim()) return j.displayName.trim()
  } catch {
    // ignore
  }
  return basename(root)
}

export async function getLibraryInfo(): Promise<LibraryInfoResponse> {
  const root = getLibraryRoot()
  const manifest = readLibraryManifestFile(root)
  const stats = await getLibraryModeStats()
  return {
    libraryRoot: root,
    manifestPath: join(root, 'manifest.json'),
    dbPath: join(root, LIBRARY_DB_NAME),
    displayName: readLibraryDisplayName(root),
    libraryMode: manifest?.libraryMode ?? getLibraryMode(),
    localization: manifest?.localization ?? null,
    stats
  }
}

export function getLibraryState(): LibraryStateResponse {
  const ud = app.getPath('userData')
  const active = getLibraryRoot()
  const st = readLibraryUserState(ud)
  const raw = st?.recentLibraries ?? []
  const merged = [active, ...raw.filter((r) => r.toLowerCase() !== active.toLowerCase())]
  const dedup: string[] = []
  const seen = new Set<string>()
  for (const r of merged) {
    const k = r.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    dedup.push(r)
  }
  const manifest = readLibraryManifestFile(active)
  return {
    activeLibraryRoot: active,
    recentLibraries: dedup,
    libraryDisplayName: readLibraryDisplayName(active),
    libraryMode: manifest?.libraryMode ?? getLibraryMode(),
    manifestPath: join(active, 'manifest.json'),
    dbPath: join(active, LIBRARY_DB_NAME)
  }
}
