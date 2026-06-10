/**
 * @deprecated Import from `themeRegistry.ts` or `themeCatalog.ts` for new code.
 * Re-exports preserve existing import paths.
 */
export type {
  AppTheme,
  AppThemeTokens,
  AppAppearanceSettings,
  ArcoThemeConfig,
  ThemeId,
  ThemeTokenSet
} from './themeRegistry'

export {
  APP_THEME_STORAGE_KEY,
  APP_THEME_CHANGED,
  DEFAULT_APP_THEME,
  DEFAULT_APP_APPEARANCE,
  DEFAULT_THEME_ID,
  THEME_CATALOG,
  THEME_TOKENS,
  formatRootCssBlock,
  getArcoThemeConfig,
  isAppTheme,
  themeTokensToCssVariables
} from './themeRegistry'
