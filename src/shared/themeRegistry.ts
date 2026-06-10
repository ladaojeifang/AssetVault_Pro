/**
 * 主题运行时 API：从 `themeCatalog.ts` 派生 CSS 变量与 Arco 配置。
 */

import { FILE_TYPE_VISUAL_BY_THEME } from './fileTypeVisualCatalog'
import {
  DEFAULT_THEME_ID,
  THEME_CATALOG,
  type ThemeId,
  type ThemeTokenSet
} from './themeCatalog'

export type { ThemeId, ThemeTokenSet }
export { DEFAULT_THEME_ID, THEME_CATALOG }

export type AppTheme = ThemeId

export const APP_THEME_STORAGE_KEY = 'assetvault-app-theme'
export const APP_THEME_CHANGED = 'assetvault:app-theme-changed'
export const DEFAULT_APP_THEME: AppTheme = DEFAULT_THEME_ID

export function isAppTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light'
}

export interface AppAppearanceSettings {
  theme: AppTheme
}

export const DEFAULT_APP_APPEARANCE: AppAppearanceSettings = {
  theme: DEFAULT_APP_THEME
}

/** @deprecated Use {@link ThemeTokenSet} */
export type AppThemeTokens = ThemeTokenSet

/** Runtime token map keyed by theme id. */
export const THEME_TOKENS: Record<AppTheme, ThemeTokenSet> = THEME_CATALOG

function fileTypeVisualCssVariables(theme: AppTheme): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, colors] of Object.entries(FILE_TYPE_VISUAL_BY_THEME[theme])) {
    out[`--av-filetype-${key}-from`] = colors.from
    out[`--av-filetype-${key}-to`] = colors.to
  }
  return out
}

/** CSS custom properties applied on `document.documentElement`. */
export function themeTokensToCssVariables(
  tokens: ThemeTokenSet,
  theme: AppTheme = DEFAULT_APP_THEME
): Record<string, string> {
  return {
    '--av-bg-primary': tokens.bgPrimary,
    '--av-bg-secondary': tokens.bgSecondary,
    '--av-bg-tertiary': tokens.bgTertiary,
    '--av-bg-elevated': tokens.bgElevated,
    '--av-bg-hover': tokens.bgHover,
    '--av-bg-active': tokens.bgActive,
    '--av-text-primary': tokens.textPrimary,
    '--av-text-secondary': tokens.textSecondary,
    '--av-text-muted': tokens.textMuted,
    '--av-accent-blue': tokens.accentBlue,
    '--av-accent-blue-hover': tokens.accentBlueHover,
    '--av-accent-blue-pressed': tokens.accentBluePressed,
    '--av-accent-purple': tokens.accentPurple,
    '--av-accent-green': tokens.accentGreen,
    '--av-accent-orange': tokens.accentOrange,
    '--av-accent-red': tokens.accentRed,
    '--av-border': tokens.border,
    '--av-border-light': tokens.borderLight,
    '--av-scrollbar-thumb': tokens.scrollbarThumb,
    '--av-scrollbar-thumb-hover': tokens.scrollbarThumbHover,
    '--av-selection-bg': tokens.selectionBg,
    '--av-selection-text': tokens.selectionText,
    '--av-shadow-modal': tokens.shadowModal,
    '--av-arco-bg-1': tokens.bgPrimary,
    '--av-arco-bg-2': tokens.bgSecondary,
    '--av-arco-bg-3': tokens.bgTertiary,
    '--av-arco-modal-bg': tokens.bgSecondary,
    '--av-arco-input-bg': tokens.bgTertiary,
    '--av-arco-message-bg': tokens.arcoMessageBg,
    '--av-status-success': tokens.statusSuccess,
    '--av-status-success-muted-bg': tokens.statusSuccessMutedBg,
    '--av-status-success-muted-text': tokens.statusSuccessMutedText,
    '--av-status-error': tokens.statusError,
    '--av-status-error-muted-bg': tokens.statusErrorMutedBg,
    '--av-status-error-muted-text': tokens.statusErrorMutedText,
    '--av-status-warning': tokens.statusWarning,
    '--av-status-warning-muted-bg': tokens.statusWarningMutedBg,
    '--av-status-warning-muted-text': tokens.statusWarningMutedText,
    '--av-status-info-muted-bg': tokens.statusInfoMutedBg,
    '--av-status-info-muted-text': tokens.statusInfoMutedText,
    '--av-badge-catalog-bg': tokens.badgeCatalogBg,
    '--av-badge-catalog-text': tokens.badgeCatalogText,
    '--av-badge-catalog-border': tokens.badgeCatalogBorder,
    '--av-badge-embedded-bg': tokens.badgeEmbeddedBg,
    '--av-badge-embedded-text': tokens.badgeEmbeddedText,
    '--av-badge-embedded-border': tokens.badgeEmbeddedBorder,
    '--av-badge-archive-bg': tokens.badgeArchiveBg,
    '--av-badge-archive-text': tokens.badgeArchiveText,
    '--av-badge-archive-border': tokens.badgeArchiveBorder,
    '--av-media-overlay-backdrop': tokens.mediaOverlayBackdrop,
    '--av-media-overlay-scrim': tokens.mediaOverlayScrim,
    '--av-media-overlay-hover': tokens.mediaOverlayHover,
    '--av-media-overlay-chip': tokens.mediaOverlayChip,
    '--av-media-overlay-text': tokens.mediaOverlayText,
    '--av-media-overlay-text-muted': tokens.mediaOverlayTextMuted,
    '--av-media-overlay-text-faint': tokens.mediaOverlayTextFaint,
    '--av-media-overlay-text-dim': tokens.mediaOverlayTextDim,
    '--av-media-overlay-border': tokens.mediaOverlayBorder,
    '--av-media-overlay-badge-bg': tokens.mediaOverlayBadgeBg,
    '--av-media-overlay-badge-text': tokens.mediaOverlayBadgeText,
    '--av-error-boundary-bg': tokens.errorBoundaryBg,
    '--av-error-boundary-text': tokens.errorBoundaryText,
    '--av-error-boundary-detail': tokens.errorBoundaryDetail,
    ...fileTypeVisualCssVariables(theme)
  }
}

/** `:root { … }` block for FOUC fallback (default dark). */
export function formatRootCssBlock(theme: AppTheme = DEFAULT_APP_THEME): string {
  const vars = themeTokensToCssVariables(THEME_TOKENS[theme], theme)
  const lines = Object.entries(vars).map(([key, value]) => `  ${key}: ${value};`)
  return `:root {\n${lines.join('\n')}\n}\n`
}

export interface ArcoThemeConfig {
  colorPrimary: string
  colorBgLayout: string
  colorBgContainer: string
  colorBgElevated: string
  colorText: string
  colorTextSecondary: string
  colorBorder: string
  borderRadiusMedium: string
}

/** Arco `ConfigProvider` theme — derived from {@link THEME_TOKENS}. */
export function getArcoThemeConfig(theme: AppTheme): ArcoThemeConfig {
  const t = THEME_TOKENS[theme]
  return {
    colorPrimary: t.accentBlue,
    colorBgLayout: t.bgPrimary,
    colorBgContainer: t.bgSecondary,
    colorBgElevated: t.bgElevated,
    colorText: t.textPrimary,
    colorTextSecondary: t.textSecondary,
    colorBorder: t.border,
    borderRadiusMedium: '6px'
  }
}
