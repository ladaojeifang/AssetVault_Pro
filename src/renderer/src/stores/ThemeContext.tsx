import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { getArcoThemeConfig, type AppTheme, type ArcoThemeConfig } from '@/shared/appTheme'
import { APP_THEME_CHANGED } from '@/shared/appTheme'
import {
  applyAppTheme,
  hydrateAppThemeFromMain,
  loadStoredAppTheme,
  persistAppTheme
} from '../theme/applyAppTheme'

interface ThemeContextValue {
  theme: AppTheme
  arcoTheme: ArcoThemeConfig
  setTheme: (theme: AppTheme) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [theme, setThemeState] = useState<AppTheme>(() => loadStoredAppTheme())

  useEffect(() => {
    void hydrateAppThemeFromMain().then(setThemeState)
  }, [])

  useEffect(() => {
    const onChanged = (e: Event) => {
      const next = (e as CustomEvent<AppTheme>).detail
      if (next === 'dark' || next === 'light') setThemeState(next)
    }
    window.addEventListener(APP_THEME_CHANGED, onChanged)
    const unsub = window.assetVaultAPI.settings.onAppAppearanceChanged(() => {
      void hydrateAppThemeFromMain().then(setThemeState)
    })
    return () => {
      window.removeEventListener(APP_THEME_CHANGED, onChanged)
      unsub()
    }
  }, [])

  const setTheme = useCallback(async (next: AppTheme) => {
    setThemeState(next)
    await persistAppTheme(next)
  }, [])

  const value = useMemo(
    () => ({
      theme,
      arcoTheme: getArcoThemeConfig(theme),
      setTheme
    }),
    [theme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider')
  return ctx
}
