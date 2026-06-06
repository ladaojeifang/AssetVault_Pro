import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { APP_LOCALE_CHANGED, type AppLocale } from '@/shared/appLocale'
import {
  applyAppLocale,
  getArcoLocaleForApp,
  hydrateAppLocaleFromMain,
  loadStoredAppLocale,
  persistAppLocale
} from '../i18n/applyAppLocale'

interface LocaleContextValue {
  locale: AppLocale
  arcoLocale: ReturnType<typeof getArcoLocaleForApp>
  setLocale: (locale: AppLocale) => Promise<void>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [locale, setLocaleState] = useState<AppLocale>(() => loadStoredAppLocale())

  useEffect(() => {
    void hydrateAppLocaleFromMain().then(setLocaleState)
  }, [])

  useEffect(() => {
    const onChanged = (e: Event) => {
      const next = (e as CustomEvent<AppLocale>).detail
      if (next === 'zh-CN' || next === 'en-US') setLocaleState(next)
    }
    window.addEventListener(APP_LOCALE_CHANGED, onChanged)
    const unsub = window.assetVaultAPI.settings.onAppPreferencesChanged(() => {
      void hydrateAppLocaleFromMain().then(setLocaleState)
    })
    return () => {
      window.removeEventListener(APP_LOCALE_CHANGED, onChanged)
      unsub()
    }
  }, [])

  const setLocale = useCallback(async (next: AppLocale) => {
    setLocaleState(next)
    await persistAppLocale(next)
  }, [])

  const value = useMemo(
    () => ({
      locale,
      arcoLocale: getArcoLocaleForApp(locale),
      setLocale
    }),
    [locale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useAppLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useAppLocale must be used within LocaleProvider')
  return ctx
}

/** Apply locale side effects without React context (e.g. before first paint). */
export { applyAppLocale, loadStoredAppLocale }
