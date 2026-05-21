import type { IpcMain } from 'electron'
import type { AiCanvasDocument } from '../../../shared/aiCanvasTypes'
import {
  listAiCanvases,
  getAiCanvas,
  createAiCanvas,
  saveAiCanvas,
  deleteAiCanvas
} from '../../services/aiCanvasStore'
import { importCanvasOutputFromPng } from '../../services/importCanvasOutput'

export function handleAiCanvasOperations(ipc: IpcMain): void {
  ipc.handle('aiCanvas:list', () => listAiCanvases())

  ipc.handle('aiCanvas:get', (_e, id: string) => getAiCanvas(id))

  ipc.handle('aiCanvas:create', (_e, name: string) => createAiCanvas(name))

  ipc.handle('aiCanvas:save', (_e, doc: AiCanvasDocument) => saveAiCanvas(doc))

  ipc.handle('aiCanvas:delete', (_e, id: string) => deleteAiCanvas(id))

  ipc.handle(
    'aiCanvas:import-output',
    (
      _e,
      payload: {
        pngBase64: string
        filename: string
        canvasId: string
        nodeId: string
        targetFolderId?: string
      }
    ) => importCanvasOutputFromPng(payload)
  )
}
