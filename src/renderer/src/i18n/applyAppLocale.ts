import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import {
  APP_LOCALE_CHANGED,
  APP_LOCALE_STORAGE_KEY,
  DEFAULT_APP_LOCALE,
  isAppLocale,
  type AppLocale
} from '@/shared/appLocale'
import { getArcoLocalePack } from './arcoLocale'
import { i18n, initI18n } from './index'

export function loadStoredAppLocale(): AppLocale {
  try {
    const v = localStorage.getItem(APP_LOCALE_STORAGE_KEY)
    if (isAppLocale(v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_APP_LOCALE
}

function dayjsLocaleFor(locale: AppLocale): string {
  return locale === 'en-US' ? 'en' : 'zh-cn'
}

/** Sync i18n, dayjs, and broadcast locale change. */
export function applyAppLocale(locale: AppLocale): void {
  initI18n(locale)
  void i18n.changeLanguage(locale)
  dayjs.locale(dayjsLocaleFor(locale))

  try {
    localStorage.setItem(APP_LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }

  window.dispatchEvent(new CustomEvent(APP_LOCALE_CHANGED, { detail: locale }))
}

export function getArcoLocaleForApp(locale: AppLocale) {
  return getArcoLocalePack(locale)
}

export async function persistAppLocale(locale: AppLocale): Promise<void> {
  applyAppLocale(locale)
  const prefs = await window.assetVaultAPI.settings.getAppPreferences()
  await window.assetVaultAPI.settings.setAppPreferences({ ...prefs, locale })
}

export async function hydrateAppLocaleFromMain(): Promise<AppLocale> {
  try {
    const prefs = await window.assetVaultAPI.settings.getAppPreferences()
    if (isAppLocale(prefs.locale)) {
      applyAppLocale(prefs.locale)
      return prefs.locale
    }
  } catch {
    /* preload not ready */
  }
  const local = loadStoredAppLocale()
  applyAppLocale(local)
  return local
}
