import {
  DEFAULT_WEB_API_PREFERENCES,
  normalizeWebApiPreferences,
  type WebApiPreferences
} from './webApiPreferences'
import {
  normalizePageVideoFormatPreset,
  type PageVideoFormatPreset
} from './pageVideoFormatPolicy'
import { DEFAULT_APP_LOCALE, normalizeAppLocale, type AppLocale } from './appLocale'
import { parseLogLevel, type LogLevel } from './logLevel'
import { PAGE_VIDEO_IMPORT_LIMITS } from './pageVideoImportTypes'

export type { AppLocale }

export type { WebApiPreferences }

export type PageVideoImportPreferences = {
  defaultFormatPreset: PageVideoFormatPreset
  maxVideoHeight: number
  notifyOnComplete: boolean
}

export type AppPreferences = {
  /** UI display language (renderer only). */
  locale: AppLocale
  /** Optional default folder for import dialogs (not all flows use this yet). */
  defaultImportPath: string
  /** After import, watch the source folder for add/change/delete. */
  autoWatchFolders: boolean
  /** Main-process log verbosity: "error" | "warn" | "info" | "debug". */
  logLevel: LogLevel
  thumbnailQuality: number
  thumbnailMaxEdge: number
  maxCacheSizeMB: number
  searchDebounceMs: number
  webApi: WebApiPreferences
  pageVideoImport: PageVideoImportPreferences
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  locale: DEFAULT_APP_LOCALE,
  defaultImportPath: '',
  autoWatchFolders: true,
  // Shared default is "info". At startup, initLogger() in main/index.ts
  // upgrades to "debug" in dev mode or uses ASSETVAULT_LOG_LEVEL env var.
  logLevel: 'info',
  thumbnailQuality: 80,
  thumbnailMaxEdge: 256,
  maxCacheSizeMB: 2048,
  searchDebounceMs: 300,
  webApi: { ...DEFAULT_WEB_API_PREFERENCES },
  pageVideoImport: {
    defaultFormatPreset: PAGE_VIDEO_IMPORT_LIMITS.defaultFormatPreset,
    maxVideoHeight: PAGE_VIDEO_IMPORT_LIMITS.defaultMaxVideoHeight,
    notifyOnComplete: false
  }
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
    locale: normalizeAppLocale(o.locale),
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
    logLevel: parseLogLevel(o.logLevel, d.logLevel),
    webApi: normalizeWebApiPreferences(o.webApi),
    pageVideoImport: normalizePageVideoImportPreferences(o.pageVideoImport)
  }
}

function normalizePageVideoImportPreferences(raw: unknown): PageVideoImportPreferences {
  const d = DEFAULT_APP_PREFERENCES.pageVideoImport
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return { ...d }
  const o = raw as Record<string, unknown>
  const preset = normalizePageVideoFormatPreset(o.defaultFormatPreset) ?? d.defaultFormatPreset
  return {
    defaultFormatPreset: preset,
    maxVideoHeight: clamp(Number(o.maxVideoHeight ?? d.maxVideoHeight), 360, 4320),
    notifyOnComplete: typeof o.notifyOnComplete === 'boolean' ? o.notifyOnComplete : d.notifyOnComplete
  }
}
