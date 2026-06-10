import {
  APP_THEME_CHANGED,
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME,
  isAppTheme,
  THEME_TOKENS,
  themeTokensToCssVariables,
  type AppTheme
} from '@/shared/appTheme'

export function loadStoredAppTheme(): AppTheme {
  try {
    const v = localStorage.getItem(APP_THEME_STORAGE_KEY)
    if (isAppTheme(v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_APP_THEME
}

/** Apply theme tokens to `document.documentElement` (sync, before first paint when possible). */
export function applyAppTheme(theme: AppTheme): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')

  const cssVars = themeTokensToCssVariables(THEME_TOKENS[theme], theme)
  for (const [key, value] of Object.entries(cssVars)) {
    root.style.setProperty(key, value)
  }

  if (document.body) {
    document.body.classList.remove('arco-theme-dark', 'arco-theme-light')
    document.body.classList.add(theme === 'light' ? 'arco-theme-light' : 'arco-theme-dark')
  }

  try {
    localStorage.setItem(APP_THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }

  window.dispatchEvent(new CustomEvent(APP_THEME_CHANGED, { detail: theme }))
}

export async function persistAppTheme(theme: AppTheme): Promise<void> {
  applyAppTheme(theme)
  await window.assetVaultAPI.settings.setAppTheme(theme)
}

export async function hydrateAppThemeFromMain(): Promise<AppTheme> {
  try {
    const { theme } = await window.assetVaultAPI.settings.getAppAppearance()
    if (isAppTheme(theme)) {
      applyAppTheme(theme)
      return theme
    }
  } catch {
    /* offline / preload not ready */
  }
  const local = loadStoredAppTheme()
  applyAppTheme(local)
  return local
}
