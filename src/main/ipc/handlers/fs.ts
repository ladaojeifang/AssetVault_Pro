import { ipcMain, dialog } from 'electron'
import { shell } from 'electron'
import { supportedExtensionsForDialog } from '@/shared/supportedFormats'
import { existsSync, statSync } from 'fs'

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
    const result = await shell.openPath(filePath)
    if (result) {
      console.error('[fs] Failed to open file:', result)
    }
    return !result // returns true on success, false on error
  })

  ipc.handle('fs:path-kind', async (_event, filePath: string) => {
    try {
      if (!existsSync(filePath)) return 'missing' as const
      return statSync(filePath).isDirectory() ? ('directory' as const) : ('file' as const)
    } catch {
      return 'missing' as const
    }
  })
}
