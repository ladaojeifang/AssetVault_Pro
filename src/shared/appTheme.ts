export type AppTheme = 'dark' | 'light'

export const APP_THEME_STORAGE_KEY = 'assetvault-app-theme'
export const APP_THEME_CHANGED = 'assetvault:app-theme-changed'

export const DEFAULT_APP_THEME: AppTheme = 'dark'

export function isAppTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light'
}

export interface AppAppearanceSettings {
  theme: AppTheme
}

export const DEFAULT_APP_APPEARANCE: AppAppearanceSettings = {
  theme: DEFAULT_APP_THEME
}

/** Single source of truth for UI + Arco colors per theme. */
export interface AppThemeTokens {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgElevated: string
  bgHover: string
  bgActive: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accentBlue: string
  accentBlueHover: string
  border: string
  borderLight: string
  scrollbarThumb: string
  scrollbarThumbHover: string
  selectionBg: string
  selectionText: string
  shadowModal: string
  arcoMessageBg: string
}

export const THEME_TOKENS: Record<AppTheme, AppThemeTokens> = {
  dark: {
    bgPrimary: '#0F1117',
    bgSecondary: '#161822',
    bgTertiary: '#1E2030',
    bgElevated: '#252837',
    bgHover: '#2D3044',
    bgActive: '#35384D',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    accentBlue: '#3B82F6',
    accentBlueHover: '#2563EB',
    border: '#151820',
    borderLight: '#232635',
    scrollbarThumb: '#2D3044',
    scrollbarThumbHover: '#4D5068',
    selectionBg: 'rgba(59, 130, 246, 0.3)',
    selectionText: '#F1F5F9',
    shadowModal: 'rgba(0, 0, 0, 0.45)',
    arcoMessageBg: '#1A1D2E'
  },
  light: {
    bgPrimary: '#F1F5F9',
    bgSecondary: '#FFFFFF',
    bgTertiary: '#F8FAFC',
    bgElevated: '#FFFFFF',
    bgHover: '#E2E8F0',
    bgActive: '#CBD5E1',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    accentBlue: '#2563EB',
    accentBlueHover: '#1D4ED8',
    border: '#D1D5DB',
    borderLight: '#E2E8F0',
    scrollbarThumb: '#CBD5E1',
    scrollbarThumbHover: '#94A3B8',
    selectionBg: 'rgba(37, 99, 235, 0.2)',
    selectionText: '#0F172A',
    shadowModal: 'rgba(15, 23, 42, 0.12)',
    arcoMessageBg: '#FFFFFF'
  }
}

/** CSS custom properties applied on `document.documentElement`. */
export function themeTokensToCssVariables(tokens: AppThemeTokens): Record<string, string> {
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
    '--av-arco-message-bg': tokens.arcoMessageBg
  }
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
