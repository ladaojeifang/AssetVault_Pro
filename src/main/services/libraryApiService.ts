import { app } from 'electron'
import { join } from 'path'
import {
  getLibraryRoot,
  LIBRARY_DB_NAME,
  libraryPathKey,
  readLibraryUserState
} from './libraryBundle'
import type { LibraryMode } from '@/shared/libraryTypes'
import { getLibraryMode, readLibraryManifestFile, readLibraryDisplayName, readLibraryModeForRoot } from './libraryManifest'
import { getLibraryModeStats } from './libraryUpgrade'
import type { LibraryInfoResponse, LibraryStateResponse } from '@/shared/webApiTypes'

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
  const sessionActive = getLibraryRoot()
  const st = readLibraryUserState(ud)
  const raw = st?.recentLibraries ?? [sessionActive]
  const sessionKey = libraryPathKey(sessionActive)
  const merged =
    raw.some((r) => libraryPathKey(r) === sessionKey)
      ? raw
      : [sessionActive, ...raw.filter((r) => libraryPathKey(r) !== sessionKey)]
  const dedup: string[] = []
  const displayNames: string[] = []
  const modes: LibraryMode[] = []
  const seen = new Set<string>()
  for (const r of merged) {
    const k = libraryPathKey(r)
    if (!k || seen.has(k)) continue
    seen.add(k)
    dedup.push(r)
    displayNames.push(readLibraryDisplayName(r))
    modes.push(readLibraryModeForRoot(r))
  }
  const manifest = readLibraryManifestFile(sessionActive)
  return {
    activeLibraryRoot: sessionActive,
    recentLibraries: dedup,
    recentLibraryDisplayNames: displayNames,
    recentLibraryModes: modes,
    libraryDisplayName: readLibraryDisplayName(sessionActive),
    libraryMode: manifest?.libraryMode ?? getLibraryMode(),
    manifestPath: join(sessionActive, 'manifest.json'),
    dbPath: join(sessionActive, LIBRARY_DB_NAME)
  }
}
