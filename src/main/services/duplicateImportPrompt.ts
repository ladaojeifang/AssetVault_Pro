import { randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import type { DuplicateImportAnswer, DuplicateImportPromptPayload } from '@/shared/importTypes'

const pending = new Map<string, (answer: DuplicateImportAnswer) => void>()

let handlersRegistered = false

export function registerDuplicateImportPromptHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle(
    'import:duplicate-answer',
    (_event, requestId: unknown, answer: DuplicateImportAnswer) => {
      if (typeof requestId !== 'string' || !answer?.resolution) return false
      const resolve = pending.get(requestId)
      if (!resolve) return false
      pending.delete(requestId)
      resolve(answer)
      return true
    }
  )
}

export function promptDuplicateImport(
  win: BrowserWindow | undefined,
  payload: Omit<DuplicateImportPromptPayload, 'requestId'>
): Promise<DuplicateImportAnswer> {
  if (!win || win.isDestroyed()) {
    return Promise.resolve({ resolution: 'import_copy' })
  }

  const requestId = randomUUID()

  return new Promise((resolve) => {
    pending.set(requestId, resolve)
    win.webContents.send('import:duplicate-prompt', { ...payload, requestId } satisfies DuplicateImportPromptPayload)
  })
}
