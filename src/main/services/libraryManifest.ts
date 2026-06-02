import { basename, join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { LibraryManifest, LibraryMode } from '@/shared/libraryTypes'

const MANIFEST_NAME = 'manifest.json'

let sessionLibraryMode: LibraryMode = 'archive'

export function getLibraryMode(): LibraryMode {
  return sessionLibraryMode
}

export function setLibraryModeForSession(mode: LibraryMode): void {
  sessionLibraryMode = mode
}

export function readLibraryManifestFile(root: string): LibraryManifest | null {
  const mf = join(root, MANIFEST_NAME)
  if (!existsSync(mf)) return null
  try {
    const raw = JSON.parse(readFileSync(mf, 'utf-8')) as Record<string, unknown>
    const mode = raw.libraryMode === 'catalog' ? 'catalog' : 'archive'
    return {
      formatVersion: typeof raw.formatVersion === 'string' ? raw.formatVersion : '1.0',
      appId: typeof raw.appId === 'string' ? raw.appId : 'com.assetvault.library',
      libraryId: typeof raw.libraryId === 'string' ? raw.libraryId : '',
      displayName:
        typeof raw.displayName === 'string' && raw.displayName.trim()
          ? raw.displayName.trim()
          : 'AssetVault Library',
      libraryMode: mode,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      localization: raw.localization as LibraryManifest['localization']
    }
  } catch {
    return null
  }
}

/** Human-readable library name for UI and import source tag (manifest displayName, else folder basename). */
export function readLibraryDisplayName(root: string): string {
  const mf = join(root, MANIFEST_NAME)
  if (!existsSync(mf)) return basename(root)
  try {
    const raw = JSON.parse(readFileSync(mf, 'utf-8')) as { displayName?: unknown }
    if (typeof raw.displayName === 'string' && raw.displayName.trim()) {
      return raw.displayName.trim()
    }
  } catch {
    /* ignore malformed manifest */
  }
  return basename(root)
}

export function loadLibraryModeFromManifest(root: string): LibraryMode {
  const m = readLibraryManifestFile(root)
  const mode = m?.libraryMode ?? 'archive'
  setLibraryModeForSession(mode)
  return mode
}

export function writeLibraryManifest(root: string, patch: Partial<LibraryManifest>): LibraryManifest {
  const mf = join(root, MANIFEST_NAME)
  const prev = readLibraryManifestFile(root)
  const now = new Date().toISOString()
  const body: LibraryManifest = {
    formatVersion: patch.formatVersion ?? prev?.formatVersion ?? '1.1',
    appId: patch.appId ?? prev?.appId ?? 'com.assetvault.library',
    libraryId: patch.libraryId ?? prev?.libraryId ?? uuidv4(),
    displayName: patch.displayName ?? prev?.displayName ?? 'AssetVault Library',
    libraryMode: patch.libraryMode ?? prev?.libraryMode ?? 'archive',
    createdAt: patch.createdAt ?? prev?.createdAt ?? now,
    updatedAt: now,
    localization: patch.localization ?? prev?.localization
  }
  writeFileSync(mf, JSON.stringify(body, null, 2), 'utf-8')
  setLibraryModeForSession(body.libraryMode)
  return body
}
