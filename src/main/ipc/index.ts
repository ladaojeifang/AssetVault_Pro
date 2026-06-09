import { ipcMain, BrowserWindow } from 'electron'
import { handleFolderOperations } from './handlers/folders'
import { handleAssetOperations } from './handlers/assets'
import { handleTagOperations } from './handlers/tags'
import { handleFsOperations } from './handlers/fs'
import { handleLibraryOperations } from './handlers/library'
import { handleAiCanvasOperations } from './handlers/aiCanvas'
import { handleWindowOperations } from './handlers/window'
import { handleFontOperations } from './handlers/fonts'
import { handleExrOperations } from './handlers/exr'
import { handleSettingsOperations } from './handlers/settings'
import { installIpcTrace } from '../utils/logger'

export function registerIpcHandlers(ipc: typeof ipcMain): void {
  // Dev mode: install IPC tracing BEFORE registering handlers
  // so every ipcMain.handle/on call gets wrapped
  installIpcTrace(ipc)
  // Window controls
  ipc.handle('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
    return true
  })

  ipc.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
    return win?.isMaximized() ?? false
  })

  ipc.handle('window:close', () => {
    BrowserWindow.getFocusedWindow()?.close()
    return true
  })

  ipc.handle('window:is-maximized', () => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false
  })

  // Register domain handlers
  handleFolderOperations(ipc)
  handleAssetOperations(ipc)
  handleTagOperations(ipc)
  handleFsOperations(ipc)
  handleLibraryOperations(ipc)
  handleAiCanvasOperations(ipc)
  handleWindowOperations(ipc)
  handleFontOperations(ipc)
  handleExrOperations(ipc)
  handleSettingsOperations(ipc)

  console.log('[IPC] All handlers registered successfully')
}
