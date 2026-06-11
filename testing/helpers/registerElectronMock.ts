import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { vi } from 'vitest'

const testUserData = mkdtempSync(join(tmpdir(), 'av-vitest-userdata-'))

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return testUserData
      if (name === 'temp') return join(testUserData, 'temp')
      return join(testUserData, name)
    },
    getVersion: () => '0.0.0-test',
    isPackaged: false
  },
  BrowserWindow: {
    getAllWindows: () => []
  },
  ipcMain: {
    emit: vi.fn(),
    on: vi.fn(),
    handle: vi.fn()
  }
}))

vi.mock('@main/services/importNotify', () => ({
  notifyAllWindowsAssetsImported: vi.fn()
}))

export const fileWatcherStop = vi.fn()
export const fileWatcherWatch = vi.fn()

vi.mock('@main/services/FileWatcher', () => ({
  getFileWatcher: () => ({
    stop: fileWatcherStop,
    watch: fileWatcherWatch,
    unwatch: vi.fn()
  })
}))
