import type { IpcMain } from 'electron'
import {
  clearCrossWindowAssetDrag,
  consumeCrossWindowAssetDrag,
  isCrossWindowAssetDragActive,
  setCrossWindowAssetDrag
} from '../../services/assetDragBridge'
import {
  closeAiCanvasWindow,
  focusMainWindow,
  getAiCanvasWindow,
  openAiCanvasWindow
} from '../../services/aiCanvasWindow'
import { getSettingsWindow, openSettingsWindow } from '../../services/settingsWindow'
import { getMainBrowserWindow } from '../../services/mainWindowRef'

export function handleWindowOperations(ipc: IpcMain): void {
  ipc.handle('window:open-ai-canvas', (_e, canvasId?: string | null) => {
    openAiCanvasWindow(canvasId ?? null)
    return true
  })

  ipc.handle('window:open-settings', () => {
    openSettingsWindow()
    return true
  })

  ipc.handle('window:focus-main', () => {
    focusMainWindow()
    return true
  })

  ipc.handle('window:get-role', (event) => {
    const canvas = getAiCanvasWindow()
    if (canvas && !canvas.isDestroyed() && event.sender.id === canvas.webContents.id) {
      return 'ai-canvas' as const
    }
    const settings = getSettingsWindow()
    if (settings && !settings.isDestroyed() && event.sender.id === settings.webContents.id) {
      return 'settings' as const
    }
    const main = getMainBrowserWindow()
    if (main && !main.isDestroyed() && event.sender.id === main.webContents.id) {
      return 'main' as const
    }
    return 'unknown' as const
  })

  ipc.handle('assetDrag:set', (_e, assetIds: string[]) => {
    setCrossWindowAssetDrag(Array.isArray(assetIds) ? assetIds : [])
    const canvas = getAiCanvasWindow()
    if (canvas && !canvas.isDestroyed()) {
      canvas.webContents.send('asset-drag:state', {
        active: isCrossWindowAssetDragActive(),
        assetIds: assetIds ?? []
      })
    }
    return true
  })

  ipc.handle('assetDrag:clear', () => {
    clearCrossWindowAssetDrag()
    const canvas = getAiCanvasWindow()
    if (canvas && !canvas.isDestroyed()) {
      canvas.webContents.send('asset-drag:state', { active: false, assetIds: [] })
    }
    return true
  })

  ipc.handle('assetDrag:is-active', () => isCrossWindowAssetDragActive())

  ipc.handle('assetDrag:consume', () => consumeCrossWindowAssetDrag())
}
