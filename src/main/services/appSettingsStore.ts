import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import {
  DEFAULT_APP_APPEARANCE,
  isAppTheme,
  type AppAppearanceSettings,
  type AppTheme
} from '@/shared/appTheme'

const SETTINGS_FILE = 'app-settings.json'

function settingsPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, SETTINGS_FILE)
}

export function readAppAppearanceSettings(): AppAppearanceSettings {
  try {
    const p = settingsPath()
    if (!existsSync(p)) return { ...DEFAULT_APP_APPEARANCE }
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as { theme?: unknown }
    return {
      theme: isAppTheme(raw.theme) ? raw.theme : DEFAULT_APP_APPEARANCE.theme
    }
  } catch {
    return { ...DEFAULT_APP_APPEARANCE }
  }
}

export function writeAppTheme(theme: AppTheme): AppAppearanceSettings {
  const next: AppAppearanceSettings = { theme }
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}
