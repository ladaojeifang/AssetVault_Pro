import { ipcMain, dialog, clipboard } from 'electron'
import { shell } from 'electron'
import { pathToFileURL } from 'url'
import { dirname } from 'path'
import { supportedExtensionsForDialog } from '@/shared/supportedFormats'
import { existsSync, statSync } from 'fs'
import { readFile } from 'fs/promises'
import { eq, inArray } from 'drizzle-orm'
import { resolveLibraryPath, isLibraryReady } from '../../services/libraryBundle'
import { resolveAssetContentPath } from '../../services/assetPathResolver'
import { getDatabase } from '../../db'
import { assets } from '../../db/schema'
import { copyFilesToSystemClipboard } from '../../utils/clipboardFiles'
import { assertPlainObject, assertString, assertStringArray } from '../ipcGuards'

function toShellPath(stored: string): string {
  if (!isLibraryReady()) return stored
  try {
    return resolveLibraryPath(stored)
  } catch {
    return stored
  }
}

export function handleFsOperations(ipc: typeof ipcMain): void {
  // Open file selection dialog
  ipc.handle(
    'fs:select-dialog',
    async (
      _event,
      options?: {
        multi?: boolean
        filters?: Array<{ name: string; extensions: string[] }>
      }
    ) => {
      if (options != null) assertPlainObject('options', options)
      const result = await dialog.showOpenDialog({
        properties: options?.multi ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: options?.filters || [
          { name: 'All Supported Files', extensions: supportedExtensionsForDialog() }
        ]
      })

      if (result.canceled) return []
      return result.filePaths
    }
  )

  // Open folder selection dialog
  ipc.handle('fs:select-folder-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (result.canceled) return null
    return result.filePaths[0]
  })

  // Open file in system default application
  ipc.handle('fs:open-in-explorer', async (_event, filePath: string) => {
    assertString('filePath', filePath)
    const abs = toShellPath(filePath)
    const result = await shell.openPath(abs)
    if (result) {
      console.error('[fs] Failed to open file:', result)
    }
    return !result // returns true on success, false on error
  })

  ipc.handle('fs:path-to-file-url', async (_event, filePath: string) => {
    assertString('filePath', filePath)
    try {
      const abs = toShellPath(filePath)
      return pathToFileURL(abs).href
    } catch {
      return null
    }
  })

  /** Read library file bytes for renderer 3D loaders (file:// XHR is blocked in sandbox). */
  ipc.handle('fs:read-file-bytes', async (_event, filePath: string) => {
    assertString('filePath', filePath)
    const abs = toShellPath(filePath)
    const buf = await readFile(abs)
    return Uint8Array.from(buf)
  })

  ipc.handle('fs:path-kind', async (_event, filePath: string) => {
    assertString('filePath', filePath)
    try {
      const abs = toShellPath(filePath)
      if (!existsSync(abs)) return 'missing' as const
      return statSync(abs).isDirectory() ? ('directory' as const) : ('file' as const)
    } catch {
      return 'missing' as const
    }
  })

  ipc.handle('fs:write-text-to-clipboard', async (_event, text: string) => {
    assertString('text', text)
    clipboard.writeText(text ?? '')
    return true
  })

  /** Reveal the asset's content file in the system file manager (index = source path, full = library copy). */
  ipc.handle('fs:open-asset-item-directory', async (_event, assetId: string) => {
    assertString('assetId', assetId)
    const database = getDatabase()
    const row = await database
      .select({ filePath: assets.filePath, storageMode: assets.storageMode })
      .from(assets)
      .where(eq(assets.id, assetId))
      .get()
    if (!row) throw new Error('资产不存在')

    const abs = resolveAssetContentPath(row)
    if (existsSync(abs)) {
      shell.showItemInFolder(abs)
      return true
    }

    const dir = dirname(abs)
    if (existsSync(dir)) {
      const result = await shell.openPath(dir)
      if (result) throw new Error(result)
      return true
    }

    throw new Error('源文件或所在目录不存在')
  })

  ipc.handle('fs:copy-files-to-clipboard', async (_event, assetIds: string[]) => {
    assertStringArray('assetIds', assetIds)
    const database = getDatabase()
    const rows = await database
      .select({ filePath: assets.filePath })
      .from(assets)
      .where(inArray(assets.id, assetIds))
      .all()
    const paths = rows
      .map((r) => {
        try {
          return resolveLibraryPath(r.filePath)
        } catch {
          return null
        }
      })
      .filter((p): p is string => !!p && existsSync(p))
    return copyFilesToSystemClipboard(paths)
  })

  ipc.handle('fs:copy-paths-to-clipboard', async (_event, assetIds: string[]) => {
    assertStringArray('assetIds', assetIds)
    const database = getDatabase()
    const rows = await database
      .select({ filePath: assets.filePath })
      .from(assets)
      .where(inArray(assets.id, assetIds))
      .all()
    const lines = rows
      .map((r) => {
        try {
          return resolveLibraryPath(r.filePath)
        } catch {
          return null
        }
      })
      .filter((p): p is string => !!p)
    clipboard.writeText(lines.join('\r\n'))
    return lines.length
  })
}
