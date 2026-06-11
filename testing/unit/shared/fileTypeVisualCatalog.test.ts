import { describe, expect, it } from 'vitest'
import type { ThemeId } from '@/shared/themeCatalog'
import {
  FILE_TYPE_VISUAL_BY_THEME,
  FILE_TYPE_VISUAL_KEYS,
  fileTypeVisualCssVars,
  resolveFileTypeVisualKey
} from '@/shared/fileTypeVisualCatalog'

describe('fileTypeVisualCatalog', () => {
  it('defines non-empty gradient colors for every file type in both themes', () => {
    for (const theme of ['dark', 'light'] as ThemeId[]) {
      for (const key of FILE_TYPE_VISUAL_KEYS) {
        const colors = FILE_TYPE_VISUAL_BY_THEME[theme][key]
        expect(colors.from.trim().length).toBeGreaterThan(0)
        expect(colors.to.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('resolveFileTypeVisualKey maps known types and falls back to document', () => {
    expect(resolveFileTypeVisualKey('image')).toBe('image')
    expect(resolveFileTypeVisualKey('3d')).toBe('3d')
    expect(resolveFileTypeVisualKey('other')).toBe('document')
    expect(resolveFileTypeVisualKey('')).toBe('document')
  })

  it('fileTypeVisualCssVars exposes --av-filetype-from/to', () => {
    const vars = fileTypeVisualCssVars('dark', 'video')
    expect(vars['--av-filetype-from']).toBe(FILE_TYPE_VISUAL_BY_THEME.dark.video.from)
    expect(vars['--av-filetype-to']).toBe(FILE_TYPE_VISUAL_BY_THEME.dark.video.to)
  })
})
