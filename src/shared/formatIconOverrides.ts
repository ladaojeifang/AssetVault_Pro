/** Icon shown in grid/detail when a file extension has no generated thumbnail. */

export type FormatIconKind = 'emoji' | 'image'

export interface FormatIconEntry {
  /** Lowercase extension without dot, e.g. `blend` */
  extension: string
  kind: FormatIconKind
  /** Emoji/text, or absolute path to an image file under userData */
  value: string
}

export interface FormatIconOverridesSettings {
  entries: FormatIconEntry[]
}

export const FORMAT_ICON_OVERRIDES_CHANGED = 'settings:format-icon-overrides-changed'

/** Suggested icons for 3D import-only formats (no auto thumbnail). */
export const DEFAULT_FORMAT_ICON_ENTRIES: FormatIconEntry[] = [
  { extension: 'abc', kind: 'emoji', value: '📐' },
  { extension: 'ma', kind: 'emoji', value: '🎭' },
  { extension: 'mb', kind: 'emoji', value: '🎭' },
  { extension: 'max', kind: 'emoji', value: '🔷' },
  { extension: 'c4d', kind: 'emoji', value: '🎬' },
  { extension: 'hip', kind: 'emoji', value: '🔥' },
  { extension: 'usd', kind: 'emoji', value: '💎' },
  { extension: 'usda', kind: 'emoji', value: '💎' },
  { extension: 'usdz', kind: 'emoji', value: '💎' },
  { extension: 'blend', kind: 'emoji', value: '🧊' }
]

export function normalizeFormatExtension(ext: string): string {
  return ext.trim().replace(/^\./, '').toLowerCase()
}

export function isValidFormatExtension(ext: string): boolean {
  const n = normalizeFormatExtension(ext)
  return /^[a-z0-9][a-z0-9]{0,15}$/i.test(n)
}

export function buildFormatIconMap(
  entries: FormatIconEntry[]
): Map<string, FormatIconEntry> {
  const map = new Map<string, FormatIconEntry>()
  for (const e of entries) {
    const key = normalizeFormatExtension(e.extension)
    if (!key || !isValidFormatExtension(key)) continue
    map.set(key, { ...e, extension: key })
  }
  return map
}

export function normalizeFormatIconSettings(
  raw: Partial<FormatIconOverridesSettings> | null | undefined
): FormatIconOverridesSettings {
  const list = Array.isArray(raw?.entries) ? raw.entries : []
  const seen = new Set<string>()
  const entries: FormatIconEntry[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const extension = normalizeFormatExtension(String(item.extension ?? ''))
    if (!extension || !isValidFormatExtension(extension) || seen.has(extension)) continue
    const kind = item.kind === 'image' ? 'image' : 'emoji'
    const value = String(item.value ?? '').trim()
    if (!value) continue
    seen.add(extension)
    entries.push({ extension, kind, value })
  }
  entries.sort((a, b) => a.extension.localeCompare(b.extension))
  return { entries }
}
