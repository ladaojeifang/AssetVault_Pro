import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LibraryMode } from '@/shared/libraryTypes'
import { closeDatabase, initDatabase } from '@main/db'
import {
  LIBRARY_DB_NAME,
  ensureLibraryDirectories,
  ensureManifest,
  setLibraryRootForSession
} from '@main/services/libraryBundle'
import { getThumbnailService } from '@main/services/ThumbnailService'

export interface TempLibraryContext {
  libraryRoot: string
  dbPath: string
  libraryMode: LibraryMode
}

export type TempLibraryHandle = TempLibraryContext & {
  close: () => Promise<void>
}

async function teardownLibrary(libraryRoot: string): Promise<void> {
  getThumbnailService().setLibraryRoot(null)
  await closeDatabase()
  // Let in-flight thumbnail writes finish before Windows rmdir (EPERM/ENOTEMPTY).
  await new Promise((r) => setTimeout(r, 150))
  try {
    rmSync(libraryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  } catch {
    /* ignore */
  }
}

/** Open a temp library; caller must invoke `close()` when done. */
export async function createTempLibrary(libraryMode: LibraryMode): Promise<TempLibraryHandle> {
  const libraryRoot = mkdtempSync(join(tmpdir(), `av-test-lib-${libraryMode}-`))
  ensureLibraryDirectories(libraryRoot)
  ensureManifest(libraryRoot, { libraryMode })
  setLibraryRootForSession(libraryRoot)
  getThumbnailService().setLibraryRoot(libraryRoot)

  const dbPath = join(libraryRoot, LIBRARY_DB_NAME)
  await initDatabase(dbPath)

  return {
    libraryRoot,
    dbPath,
    libraryMode,
    close: () => teardownLibrary(libraryRoot)
  }
}

/**
 * Create an isolated archive/catalog/embedded library, open SQLite, run fn, then tear down.
 * Import `registerElectronMock` in the test file before other `@main` imports.
 */
export async function withTempLibrary<T>(
  libraryMode: LibraryMode,
  fn: (ctx: TempLibraryContext) => Promise<T>
): Promise<T> {
  const handle = await createTempLibrary(libraryMode)
  try {
    return await fn(handle)
  } finally {
    await handle.close()
  }
}
