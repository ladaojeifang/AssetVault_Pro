import { i18n } from './index'

/** Map API error code to UI string; falls back to server message unchanged. */
export function translateErrorCode(code: string | undefined, fallback?: string): string {
  if (!code) return fallback ?? i18n.t('errors:UNKNOWN')
  const key = `errors:${code}`
  if (i18n.exists(key)) return i18n.t(key)
  return fallback ?? i18n.t('errors:UNKNOWN')
}
