import {
  DEFAULT_WEB_API_PREFERENCES,
  normalizeWebApiPreferences,
  type WebApiPreferences
} from './webApiPreferences'

export type { WebApiPreferences }

export type AppPreferences = {
  /** Optional default folder for import dialogs (not all flows use this yet). */
  defaultImportPath: string
  /** After import, watch the source folder for add/change/delete. */
  autoWatchFolders: boolean
  thumbnailQuality: number
  thumbnailMaxEdge: number
  maxCacheSizeMB: number
  searchDebounceMs: number
  webApi: WebApiPreferences
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  defaultImportPath: '',
  autoWatchFolders: true,
  thumbnailQuality: 80,
  thumbnailMaxEdge: 256,
  maxCacheSizeMB: 2048,
  searchDebounceMs: 300,
  webApi: { ...DEFAULT_WEB_API_PREFERENCES }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.floor(n)))
}

/** Coerce persisted JSON into safe preferences. */
export function normalizeAppPreferences(raw: unknown): AppPreferences {
  const d = DEFAULT_APP_PREFERENCES
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return { ...d }
  const o = raw as Record<string, unknown>
  return {
    defaultImportPath: typeof o.defaultImportPath === 'string' ? o.defaultImportPath : d.defaultImportPath,
    autoWatchFolders:
      typeof o.autoWatchFolders === 'boolean'
        ? o.autoWatchFolders
        : typeof o.enableFileWatcher === 'boolean'
          ? o.enableFileWatcher
          : d.autoWatchFolders,
    thumbnailQuality: clamp(Number(o.thumbnailQuality), 10, 100),
    thumbnailMaxEdge: clamp(
      Number(o.thumbnailMaxEdge ?? o.thumbnailSize ?? d.thumbnailMaxEdge),
      128,
      512
    ),
    maxCacheSizeMB: clamp(Number(o.maxCacheSizeMB), 256, 10240),
    searchDebounceMs: clamp(Number(o.searchDebounceMs ?? o.debounceMs), 100, 800),
    webApi: normalizeWebApiPreferences(o.webApi)
  }
}
