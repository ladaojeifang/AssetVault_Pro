import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { join, basename } from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { count } from 'drizzle-orm'
import { getDatabase } from '../../db'
import { assets } from '../../db/schema'
import {
  getLibraryRoot,
  LIBRARY_DB_NAME,
  ITEMS_DIR,
  readLibraryUserState,
  removeFromRecentList
} from '../../services/libraryBundle'
import type { LibraryMode } from '@/shared/libraryTypes'
import { getLibraryMode, readLibraryManifestFile } from '../../services/libraryManifest'
import {
  getLibraryModeStats,
  upgradeCatalogLibraryToArchive,
  verifyReferencedSources
} from '../../services/libraryUpgrade'
import { getLibraryInfo, getLibraryState } from '../../services/libraryApiService'
import {
  switchActiveLibrary,
  assertEmptyDirectoryForNewLibrary,
  prepareNewLibrarySkeleton
} from '../../services/librarySwitch'
import { assertOptionalPlainObject, assertOptionalBoolean } from '../ipcGuards'

function dialogParent(event: Electron.IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow() ?? undefined
}

function readLibraryDisplayName(root: string): string {
  const mf = join(root, 'manifest.json')
  if (!existsSync(mf)) return basename(root)
  try {
    const j = JSON.parse(readFileSync(mf, 'utf-8')) as { displayName?: unknown }
    if (typeof j.displayName === 'string' && j.displayName.trim()) return j.displayName.trim()
  } catch {
    // ignore malformed manifest
  }
  return basename(root)
}

export function handleLibraryOperations(ipc: typeof ipcMain): void {
  ipc.handle('library:get-state', async () => getLibraryState())

  ipc.handle('library:switch', async (_event, targetRoot: unknown) => {
    if (typeof targetRoot !== 'string' || !targetRoot.trim()) {
      return { ok: false as const, error: '无效路径' }
    }
    const tr = targetRoot.trim()
    if (tr.toLowerCase() === getLibraryRoot().toLowerCase()) {
      return { ok: true as const }
    }
    return switchActiveLibrary(tr)
  })

  ipc.handle('library:pick-and-switch', async (event) => {
    const parent = dialogParent(event)
    const r = await dialog.showOpenDialog(parent, {
      properties: ['openDirectory'],
      title: '选择资料库文件夹（需包含 library.sqlite，或空库将自动初始化）'
    })
    if (r.canceled || !r.filePaths[0]) {
      return { ok: false as const, error: 'cancelled' }
    }
    const p = r.filePaths[0]
    if (p.toLowerCase() === getLibraryRoot().toLowerCase()) {
      return { ok: true as const }
    }
    return switchActiveLibrary(p)
  })

  ipc.handle('library:create-and-switch', async (event, libraryModeRaw: unknown) => {
    const parent = dialogParent(event)
    const libraryMode: LibraryMode = libraryModeRaw === 'catalog' ? 'catalog' : 'archive'
    const title =
      libraryMode === 'catalog'
        ? '选择空文件夹以创建索引资料库（不拷贝原文件）'
        : '选择空文件夹以创建完整资料库'
    const r = await dialog.showOpenDialog(parent, {
      properties: ['openDirectory', 'createDirectory'],
      title
    })
    if (r.canceled || !r.filePaths[0]) {
      return { ok: false as const, error: 'cancelled' }
    }
    const p = r.filePaths[0]
    try {
      const root = assertEmptyDirectoryForNewLibrary(p)
      prepareNewLibrarySkeleton(root, libraryMode)
      return await switchActiveLibrary(root)
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipc.handle('library:remove-from-recent', async (_event, pathToRemove: unknown) => {
    if (typeof pathToRemove !== 'string' || !pathToRemove.trim()) {
      return { ok: false as const, error: '无效路径' }
    }
    const ud = app.getPath('userData')
    try {
      removeFromRecentList(ud, pathToRemove.trim())
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipc.handle('library:get-info', async () => getLibraryInfo())

  ipc.handle('library:get-mode-stats', async () => getLibraryModeStats())

  ipc.handle('library:upgrade-to-archive', async (event, options?: { preferHardlink?: boolean }) => {
    const win = dialogParent(event)
    assertOptionalPlainObject('options', options)
    assertOptionalBoolean('options.preferHardlink', (options as any)?.preferHardlink)
    return upgradeCatalogLibraryToArchive(win, options)
  })

  ipc.handle('library:verify-sources', async () => verifyReferencedSources())

  /** DB row count vs `items/` subfolders — diagnose orphan packs or empty UI. */
  ipc.handle('library:get-storage-stats', async () => {
    const root = getLibraryRoot()
    const itemsDir = join(root, ITEMS_DIR)
    let itemPackCount = 0
    if (existsSync(itemsDir)) {
      itemPackCount = readdirSync(itemsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length
    }
    const database = getDatabase()
    const row = await database.select({ count: count() }).from(assets).get()
    const assetRowCount = Number(row?.count ?? 0)
    return { assetRowCount, itemPackCount, itemsDir }
  })
}
