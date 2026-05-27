import { BrowserWindow, ipcMain, shell } from 'electron'
import { isAppTheme, type AppTheme } from '@/shared/appTheme'
import {
  normalizeFormatIconSettings,
  type FormatIconOverridesSettings
} from '@/shared/formatIconOverrides'
import { readAppAppearanceSettings, writeAppTheme } from '../../services/appSettingsStore'
import { readAppPreferences, writeAppPreferences } from '../../services/appPreferencesStore'
import { normalizeAppPreferences } from '@/shared/appPreferences'
import {
  importFormatIconImage,
  pruneOrphanFormatIconImages,
  readFormatIconOverrides,
  removeStoredFormatIconImage,
  writeFormatIconOverrides
} from '../../services/formatIconOverridesStore'
import {
  applyWebApiFromPreferences,
  getWebApiStatus,
  regenerateWebApiToken
} from '../../api/webApiRuntime'

function notifyFormatIconOverridesChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send('settings:format-icon-overrides-changed')
    }
  }
}

function notifyAppAppearanceChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send('settings:app-appearance-changed')
    }
  }
}

export function handleSettingsOperations(ipc: typeof ipcMain): void {
  ipc.handle('settings:get-app-preferences', async () => readAppPreferences())

  ipc.handle('settings:set-app-preferences', async (_event, raw: unknown) => {
    const next = writeAppPreferences(normalizeAppPreferences(raw))
    await applyWebApiFromPreferences()
    return next
  })

  ipc.handle('settings:get-web-api-status', async () => getWebApiStatus())

  ipc.handle('settings:regenerate-web-api-token', async () => regenerateWebApiToken())

  ipc.handle('settings:open-web-api-playground', async (_event, url: unknown) => {
    if (typeof url !== 'string' || !url.startsWith('http://127.0.0.1')) {
      throw new Error('无效的 Playground URL')
    }
    await shell.openExternal(url)
    return true
  })

  ipc.handle('settings:get-app-appearance', async () => readAppAppearanceSettings())

  ipc.handle('settings:set-app-theme', async (_event, theme: unknown) => {
    if (!isAppTheme(theme)) {
      throw new Error('无效的主题')
    }
    const next = writeAppTheme(theme)
    notifyAppAppearanceChanged()
    return next
  })

  ipc.handle('settings:get-format-icon-overrides', async () => readFormatIconOverrides())

  ipc.handle(
    'settings:set-format-icon-overrides',
    async (_event, settings: FormatIconOverridesSettings) => {
      const prev = readFormatIconOverrides()
      for (const e of prev.entries) {
        if (e.kind === 'image') {
          const stillUsed = settings.entries.some(
            (n) => n.kind === 'image' && n.value === e.value
          )
          if (!stillUsed) removeStoredFormatIconImage(e.value)
        }
      }
      const next = writeFormatIconOverrides(normalizeFormatIconSettings(settings))
      pruneOrphanFormatIconImages(next.entries)
      notifyFormatIconOverridesChanged()
      return next
    }
  )

  ipc.handle(
    'settings:import-format-icon-image',
    async (_event, extension: string, sourcePath: string) => {
      const path = importFormatIconImage(sourcePath, extension)
      return { path }
    }
  )
}
