import { app, BrowserWindow } from 'electron'
import { join, normalize } from 'path'
import { existsSync, statSync, mkdirSync, readdirSync } from 'fs'
import type { LibraryMode } from '@/shared/libraryTypes'
import { flushDatabase, closeDatabase, initDatabase } from '../db'
import { getThumbnailService } from './ThumbnailService'
import { runLegacyPathsMigrationIfNeeded } from './libraryMigration'
import {
  LIBRARY_DB_NAME,
  ensureLibraryDirectories,
  ensureManifest,
  loadLibraryModeFromManifest,
  setLibraryRootForSession,
  getLibraryRoot,
  writeLibraryUserState,
  buildStateAfterSwitch
} from './libraryBundle'

/** Serialize library switches — overlapping async IPC could corrupt DB / active-library.json. */
let switchChain: Promise<unknown> = Promise.resolve()

function assertDirectory(path: string): string {
  const n = normalize(path.trim())
  if (!existsSync(n)) {
    throw new Error('路径不存在')
  }
  if (!statSync(n).isDirectory()) {
    throw new Error('不是文件夹')
  }
  return n
}

function broadcastLibrarySwitched(root: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('library:switched', { libraryRoot: root })
    }
  }
}

/**
 * Switch to another library root: flush/close DB, point session + thumbs at new root, reopen DB, persist user state.
 * Rolls back to previous root if reopen fails.
 */
export async function switchActiveLibrary(newRootRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const task = switchChain.then(() => switchActiveLibraryOnce(newRootRaw))
  switchChain = task.catch((err) => {
    console.error('[Library] switch chain error:', err)
  })
  return task as Promise<{ ok: true } | { ok: false; error: string }>
}

async function switchActiveLibraryOnce(newRootRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const userData = app.getPath('userData')
  let previousRoot: string | null = null
  try {
    previousRoot = getLibraryRoot()
  } catch {
    previousRoot = null
  }

  try {
    const root = assertDirectory(newRootRaw)
    const dbPath = join(root, LIBRARY_DB_NAME)

    if (!existsSync(dbPath)) {
      mkdirSync(root, { recursive: true })
      ensureLibraryDirectories(root)
      ensureManifest(root)
    }

    await flushDatabase()
    await closeDatabase()

    setLibraryRootForSession(root)
    getThumbnailService().setLibraryRoot(root)

    await initDatabase(dbPath)
    await runLegacyPathsMigrationIfNeeded()
    await flushDatabase()
    loadLibraryModeFromManifest(root)

    writeLibraryUserState(userData, buildStateAfterSwitch(userData, root))
    broadcastLibrarySwitched(root)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[Library] Switch failed:', e)

    if (previousRoot) {
      try {
        await closeDatabase()
        setLibraryRootForSession(previousRoot)
        getThumbnailService().setLibraryRoot(previousRoot)
        await initDatabase(join(previousRoot, LIBRARY_DB_NAME))
        await flushDatabase()
      } catch (rollbackErr) {
        console.error('[Library] Rollback failed:', rollbackErr)
      }
    }

    return { ok: false, error: msg }
  }
}

/** Folder must be empty (except . / ..) for a brand-new library. */
export function assertEmptyDirectoryForNewLibrary(dir: string): string {
  const root = assertDirectory(dir)
  const names = readdirSync(root).filter((n) => n !== '.' && n !== '..')
  if (names.length > 0) {
    throw new Error('请选择空文件夹作为新资料库位置')
  }
  return root
}

export function prepareNewLibrarySkeleton(root: string, libraryMode: LibraryMode = 'archive'): void {
  mkdirSync(root, { recursive: true })
  ensureLibraryDirectories(root)
  ensureManifest(root, { libraryMode })
}
