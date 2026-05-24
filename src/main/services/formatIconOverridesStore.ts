import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { extname, join } from 'path'
import { app } from 'electron'
import {
  DEFAULT_FORMAT_ICON_ENTRIES,
  normalizeFormatExtension,
  normalizeFormatIconSettings,
  type FormatIconEntry,
  type FormatIconOverridesSettings
} from '@/shared/formatIconOverrides'

const SETTINGS_FILE = 'format-icon-overrides.json'

function userDataDir(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function settingsPath(): string {
  return join(userDataDir(), SETTINGS_FILE)
}

export function formatIconsDir(): string {
  const dir = join(userDataDir(), 'format-icons')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function readFormatIconOverrides(): FormatIconOverridesSettings {
  try {
    const p = settingsPath()
    if (!existsSync(p)) {
      return normalizeFormatIconSettings({ entries: [...DEFAULT_FORMAT_ICON_ENTRIES] })
    }
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as Partial<FormatIconOverridesSettings>
    const normalized = normalizeFormatIconSettings(raw)
    return normalized.entries.length > 0
      ? normalized
      : normalizeFormatIconSettings({ entries: [...DEFAULT_FORMAT_ICON_ENTRIES] })
  } catch {
    return normalizeFormatIconSettings({ entries: [...DEFAULT_FORMAT_ICON_ENTRIES] })
  }
}

export function writeFormatIconOverrides(
  settings: FormatIconOverridesSettings
): FormatIconOverridesSettings {
  const normalized = normalizeFormatIconSettings(settings)
  writeFileSync(settingsPath(), JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}

export function importFormatIconImage(sourcePath: string, extension: string): string {
  const ext = normalizeFormatExtension(extension)
  if (!ext) throw new Error('无效的扩展名')

  const srcExt = extname(sourcePath).toLowerCase() || '.png'
  const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico'])
  if (!allowed.has(srcExt)) {
    throw new Error('仅支持 PNG、JPG、WebP、GIF、SVG、BMP、ICO')
  }

  const dest = join(formatIconsDir(), `${ext}${srcExt}`)
  copyFileSync(sourcePath, dest)
  return dest
}

export function removeStoredFormatIconImage(imagePath: string): void {
  const dir = formatIconsDir()
  const norm = imagePath.replace(/\\/g, '/')
  if (!norm.includes('/format-icons/')) return
  try {
    if (existsSync(imagePath)) unlinkSync(imagePath)
  } catch {
    /* ignore */
  }
}

export function pruneOrphanFormatIconImages(entries: FormatIconEntry[]): void {
  const dir = formatIconsDir()
  const used = new Set(
    entries.filter((e) => e.kind === 'image').map((e) => e.value.replace(/\\/g, '/'))
  )
  // Only prune files we manage under format-icons; skip if readdir fails
  try {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name).replace(/\\/g, '/')
      if (!used.has(full)) {
        try {
          unlinkSync(join(dir, name))
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}
