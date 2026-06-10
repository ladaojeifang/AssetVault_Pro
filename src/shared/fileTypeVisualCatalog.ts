/**
 * 无缩略图占位图渐变（按 file_type）
 * 颜色写入 `--av-filetype-*-from/to`，由 themeRegistry 按明暗主题注入。
 */

import type { ThemeId } from './themeCatalog'

export const FILE_TYPE_VISUAL_KEYS = [
  'image',
  'video',
  'audio',
  'font',
  'document',
  'design',
  '3d',
  'code'
] as const

export type FileTypeVisualKey = (typeof FILE_TYPE_VISUAL_KEYS)[number]

export interface FileTypeVisualColors {
  from: string
  to: string
}

export const FILE_TYPE_VISUAL_BY_THEME: Record<
  ThemeId,
  Record<FileTypeVisualKey, FileTypeVisualColors>
> = {
  dark: {
    image: { from: 'rgba(20, 83, 45, 0.3)', to: 'rgba(6, 78, 59, 0.2)' },
    video: { from: 'rgba(88, 28, 135, 0.3)', to: 'rgba(91, 33, 182, 0.2)' },
    audio: { from: 'rgba(131, 24, 67, 0.3)', to: 'rgba(159, 18, 57, 0.2)' },
    font: { from: 'rgba(124, 45, 18, 0.3)', to: 'rgba(146, 64, 14, 0.2)' },
    document: { from: 'rgba(30, 58, 138, 0.3)', to: 'rgba(14, 116, 144, 0.2)' },
    design: { from: 'rgba(112, 26, 117, 0.3)', to: 'rgba(157, 23, 77, 0.2)' },
    '3d': { from: 'rgba(51, 65, 85, 0.4)', to: 'rgba(15, 23, 42, 0.4)' },
    code: { from: 'rgba(6, 78, 59, 0.3)', to: 'rgba(19, 78, 74, 0.2)' }
  },
  light: {
    image: { from: 'rgba(16, 185, 129, 0.14)', to: 'rgba(5, 150, 105, 0.08)' },
    video: { from: 'rgba(139, 92, 246, 0.14)', to: 'rgba(124, 58, 237, 0.08)' },
    audio: { from: 'rgba(244, 63, 94, 0.12)', to: 'rgba(225, 29, 72, 0.08)' },
    font: { from: 'rgba(245, 158, 11, 0.14)', to: 'rgba(217, 119, 6, 0.08)' },
    document: { from: 'rgba(37, 99, 235, 0.12)', to: 'rgba(8, 145, 178, 0.08)' },
    design: { from: 'rgba(192, 38, 211, 0.12)', to: 'rgba(219, 39, 119, 0.08)' },
    '3d': { from: 'rgba(100, 116, 139, 0.18)', to: 'rgba(71, 85, 105, 0.12)' },
    code: { from: 'rgba(5, 150, 105, 0.12)', to: 'rgba(13, 148, 136, 0.08)' }
  }
}

export function resolveFileTypeVisualKey(fileType: string): FileTypeVisualKey {
  return (FILE_TYPE_VISUAL_KEYS as readonly string[]).includes(fileType)
    ? (fileType as FileTypeVisualKey)
    : 'document'
}

export function fileTypeVisualCssVars(
  theme: ThemeId,
  fileType: string
): Record<string, string> {
  const key = resolveFileTypeVisualKey(fileType)
  const colors = FILE_TYPE_VISUAL_BY_THEME[theme][key]
  return {
    '--av-filetype-from': colors.from,
    '--av-filetype-to': colors.to
  }
}
