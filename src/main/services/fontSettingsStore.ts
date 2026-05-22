import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import {
  DEFAULT_FONT_APP_SETTINGS,
  FONT_THUMB_SAMPLE_VERSION,
  type FontAppSettings
} from '@/shared/fontSettings'

const SETTINGS_FILE = 'font-settings.json'

function settingsPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, SETTINGS_FILE)
}

export function readFontAppSettings(): FontAppSettings {
  try {
    const p = settingsPath()
    if (!existsSync(p)) return { ...DEFAULT_FONT_APP_SETTINGS }
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as Partial<FontAppSettings>
    return {
      thumbSampleText:
        typeof raw.thumbSampleText === 'string' && raw.thumbSampleText.trim()
          ? raw.thumbSampleText
          : DEFAULT_FONT_APP_SETTINGS.thumbSampleText,
      thumbSampleVersion:
        typeof raw.thumbSampleVersion === 'number'
          ? raw.thumbSampleVersion
          : FONT_THUMB_SAMPLE_VERSION
    }
  } catch {
    return { ...DEFAULT_FONT_APP_SETTINGS }
  }
}

export function writeFontAppSettings(settings: FontAppSettings): FontAppSettings {
  const normalized: FontAppSettings = {
    thumbSampleText: settings.thumbSampleText.trim() || DEFAULT_FONT_APP_SETTINGS.thumbSampleText,
    thumbSampleVersion: settings.thumbSampleVersion ?? FONT_THUMB_SAMPLE_VERSION
  }
  writeFileSync(settingsPath(), JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}

export function getEffectiveThumbSampleText(): string {
  return readFontAppSettings().thumbSampleText
}

export function getEffectiveThumbSampleVersion(): number {
  return readFontAppSettings().thumbSampleVersion
}
