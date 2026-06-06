export const SUPPORTED_APP_LOCALES = ['zh-CN', 'en-US'] as const

export type AppLocale = (typeof SUPPORTED_APP_LOCALES)[number]

export const DEFAULT_APP_LOCALE: AppLocale = 'zh-CN'

export const APP_LOCALE_STORAGE_KEY = 'assetvault-app-locale'

export const APP_LOCALE_CHANGED = 'assetvault:app-locale-changed'

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'zh-CN' || value === 'en-US'
}

export function normalizeAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_APP_LOCALE
}
