/**
 * UI 明暗主题统一配置（单一数据源）
 *
 * 新增/调整颜色请只改本文件；运行时由 `themeRegistry.ts` 写入 `--av-*` CSS 变量。
 */

export type ThemeId = 'dark' | 'light'

/** 一套完整的语义色令牌（映射为 --av-*） */
export interface ThemeTokenSet {
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
  accentBluePressed: string
  accentPurple: string
  accentGreen: string
  accentOrange: string
  accentRed: string
  border: string
  borderLight: string
  scrollbarThumb: string
  scrollbarThumbHover: string
  selectionBg: string
  selectionText: string
  shadowModal: string
  arcoMessageBg: string
  statusSuccess: string
  statusSuccessMutedBg: string
  statusSuccessMutedText: string
  statusError: string
  statusErrorMutedBg: string
  statusErrorMutedText: string
  statusWarning: string
  statusWarningMutedBg: string
  statusWarningMutedText: string
  statusInfoMutedBg: string
  statusInfoMutedText: string
  badgeCatalogBg: string
  badgeCatalogText: string
  badgeCatalogBorder: string
  badgeEmbeddedBg: string
  badgeEmbeddedText: string
  badgeEmbeddedBorder: string
  badgeArchiveBg: string
  badgeArchiveText: string
  badgeArchiveBorder: string
  /** 图片/视频预览浮层（两种应用主题下均为深色衬底） */
  mediaOverlayBackdrop: string
  mediaOverlayScrim: string
  mediaOverlayHover: string
  mediaOverlayChip: string
  mediaOverlayText: string
  mediaOverlayTextMuted: string
  mediaOverlayTextFaint: string
  mediaOverlayTextDim: string
  mediaOverlayBorder: string
  mediaOverlayBadgeBg: string
  mediaOverlayBadgeText: string
  errorBoundaryBg: string
  errorBoundaryText: string
  errorBoundaryDetail: string
}

export const DEFAULT_THEME_ID: ThemeId = 'dark'

export const THEME_CATALOG: Record<ThemeId, ThemeTokenSet> = {
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
    accentBluePressed: '#1D4ED8',
    accentPurple: '#8B5CF6',
    accentGreen: '#10B981',
    accentOrange: '#F59E0B',
    accentRed: '#EF4444',
    border: '#151820',
    borderLight: '#232635',
    scrollbarThumb: '#2D3044',
    scrollbarThumbHover: '#4D5068',
    selectionBg: 'rgba(59, 130, 246, 0.3)',
    selectionText: '#F1F5F9',
    shadowModal: 'rgba(0, 0, 0, 0.45)',
    arcoMessageBg: '#1A1D2E',
    statusSuccess: '#10B981',
    statusSuccessMutedBg: 'rgba(16, 185, 129, 0.15)',
    statusSuccessMutedText: '#34D399',
    statusError: '#EF4444',
    statusErrorMutedBg: 'rgba(239, 68, 68, 0.15)',
    statusErrorMutedText: '#F87171',
    statusWarning: '#F59E0B',
    statusWarningMutedBg: 'rgba(245, 158, 11, 0.15)',
    statusWarningMutedText: '#FBBF24',
    statusInfoMutedBg: 'rgba(59, 130, 246, 0.15)',
    statusInfoMutedText: '#60A5FA',
    badgeCatalogBg: 'rgba(69, 26, 3, 0.5)',
    badgeCatalogText: '#FCD34D',
    badgeCatalogBorder: 'rgba(146, 64, 14, 0.5)',
    badgeEmbeddedBg: 'rgba(23, 37, 84, 0.4)',
    badgeEmbeddedText: '#93C5FD',
    badgeEmbeddedBorder: 'rgba(30, 58, 138, 0.4)',
    badgeArchiveBg: 'rgba(6, 78, 59, 0.4)',
    badgeArchiveText: '#6EE7B7',
    badgeArchiveBorder: 'rgba(6, 95, 70, 0.4)',
    mediaOverlayBackdrop: 'rgba(0, 0, 0, 0.9)',
    mediaOverlayScrim: 'rgba(0, 0, 0, 0.6)',
    mediaOverlayHover: 'rgba(0, 0, 0, 0.4)',
    mediaOverlayChip: 'rgba(0, 0, 0, 0.55)',
    mediaOverlayText: 'rgba(255, 255, 255, 0.92)',
    mediaOverlayTextMuted: 'rgba(255, 255, 255, 0.7)',
    mediaOverlayTextFaint: 'rgba(255, 255, 255, 0.45)',
    mediaOverlayTextDim: 'rgba(255, 255, 255, 0.3)',
    mediaOverlayBorder: 'rgba(255, 255, 255, 0.12)',
    mediaOverlayBadgeBg: 'rgba(0, 0, 0, 0.5)',
    mediaOverlayBadgeText: 'rgba(255, 255, 255, 0.82)',
    errorBoundaryBg: '#0F1117',
    errorBoundaryText: '#EF4444',
    errorBoundaryDetail: '#F87171'
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
    accentBluePressed: '#1E40AF',
    accentPurple: '#7C3AED',
    accentGreen: '#059669',
    accentOrange: '#D97706',
    accentRed: '#DC2626',
    border: '#D1D5DB',
    borderLight: '#E2E8F0',
    scrollbarThumb: '#CBD5E1',
    scrollbarThumbHover: '#94A3B8',
    selectionBg: 'rgba(37, 99, 235, 0.2)',
    selectionText: '#0F172A',
    shadowModal: 'rgba(15, 23, 42, 0.12)',
    arcoMessageBg: '#FFFFFF',
    statusSuccess: '#059669',
    statusSuccessMutedBg: 'rgba(5, 150, 105, 0.12)',
    statusSuccessMutedText: '#047857',
    statusError: '#DC2626',
    statusErrorMutedBg: 'rgba(220, 38, 38, 0.12)',
    statusErrorMutedText: '#B91C1C',
    statusWarning: '#D97706',
    statusWarningMutedBg: 'rgba(217, 119, 6, 0.12)',
    statusWarningMutedText: '#B45309',
    statusInfoMutedBg: 'rgba(37, 99, 235, 0.12)',
    statusInfoMutedText: '#1D4ED8',
    badgeCatalogBg: 'rgba(254, 243, 199, 0.9)',
    badgeCatalogText: '#B45309',
    badgeCatalogBorder: 'rgba(251, 191, 36, 0.65)',
    badgeEmbeddedBg: 'rgba(219, 234, 254, 0.95)',
    badgeEmbeddedText: '#1D4ED8',
    badgeEmbeddedBorder: 'rgba(147, 197, 253, 0.9)',
    badgeArchiveBg: 'rgba(209, 250, 229, 0.95)',
    badgeArchiveText: '#047857',
    badgeArchiveBorder: 'rgba(110, 231, 183, 0.9)',
    mediaOverlayBackdrop: 'rgba(0, 0, 0, 0.9)',
    mediaOverlayScrim: 'rgba(0, 0, 0, 0.6)',
    mediaOverlayHover: 'rgba(0, 0, 0, 0.4)',
    mediaOverlayChip: 'rgba(0, 0, 0, 0.55)',
    mediaOverlayText: 'rgba(255, 255, 255, 0.92)',
    mediaOverlayTextMuted: 'rgba(255, 255, 255, 0.7)',
    mediaOverlayTextFaint: 'rgba(255, 255, 255, 0.45)',
    mediaOverlayTextDim: 'rgba(255, 255, 255, 0.3)',
    mediaOverlayBorder: 'rgba(255, 255, 255, 0.12)',
    mediaOverlayBadgeBg: 'rgba(0, 0, 0, 0.5)',
    mediaOverlayBadgeText: 'rgba(255, 255, 255, 0.82)',
    errorBoundaryBg: '#F8FAFC',
    errorBoundaryText: '#DC2626',
    errorBoundaryDetail: '#B91C1C'
  }
}
