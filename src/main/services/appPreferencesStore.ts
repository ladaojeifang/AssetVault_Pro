import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import {
  DEFAULT_APP_PREFERENCES,
  normalizeAppPreferences,
  type AppPreferences
} from '@/shared/appPreferences'
import { getThumbnailService } from './ThumbnailService'
import { setLogLevel } from '../utils/logger'

const PREFERENCES_FILE = 'app-preferences.json'

let snapshot: AppPreferences = { ...DEFAULT_APP_PREFERENCES }

function preferencesPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, PREFERENCES_FILE)
}

export function getAppPreferencesSnapshot(): AppPreferences {
  return { ...snapshot }
}

export function readAppPreferences(): AppPreferences {
  try {
    const p = preferencesPath()
    if (!existsSync(p)) {
      snapshot = { ...DEFAULT_APP_PREFERENCES }
      return getAppPreferencesSnapshot()
    }
    const raw = JSON.parse(readFileSync(p, 'utf-8'))
    snapshot = normalizeAppPreferences(raw)
    return getAppPreferencesSnapshot()
  } catch {
    snapshot = { ...DEFAULT_APP_PREFERENCES }
    return getAppPreferencesSnapshot()
  }
}

export function writeAppPreferences(next: AppPreferences): AppPreferences {
  const normalized = normalizeAppPreferences(next)
  writeFileSync(preferencesPath(), JSON.stringify(normalized, null, 2), 'utf-8')
  snapshot = normalized
  applyAppPreferencesToRuntime(normalized)
  notifyAppPreferencesChanged()
  return getAppPreferencesSnapshot()
}

export function applyAppPreferencesToRuntime(prefs: AppPreferences = snapshot): void {
  snapshot = normalizeAppPreferences(prefs)
  setLogLevel(snapshot.logLevel)
  const thumb = getThumbnailService()
  thumb.setGenerationDefaults({
    maxEdge: snapshot.thumbnailMaxEdge,
    quality: snapshot.thumbnailQuality
  })
  thumb.setMemoryCacheLimitMB(snapshot.maxCacheSizeMB)
}

function notifyAppPreferencesChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send('settings:app-preferences-changed')
    }
  }
}

export function isAutoWatchFoldersEnabled(): boolean {
  return getAppPreferencesSnapshot().autoWatchFolders
}
