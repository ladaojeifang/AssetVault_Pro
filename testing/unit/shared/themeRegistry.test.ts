import { describe, expect, it } from 'vitest'
import { THEME_CATALOG, THEME_TOKENS, getArcoThemeConfig, themeTokensToCssVariables } from '@/shared/themeRegistry'

describe('themeRegistry', () => {
  it('exposes dark and light token sets', () => {
    expect(Object.keys(THEME_TOKENS)).toEqual(['dark', 'light'])
    expect(THEME_TOKENS.dark.bgPrimary).toBe(THEME_CATALOG.dark.bgPrimary)
  })

  it('maps tokens to --av-* CSS variables', () => {
    const vars = themeTokensToCssVariables(THEME_TOKENS.light)
    expect(vars['--av-accent-purple']).toBe(THEME_CATALOG.light.accentPurple)
    expect(vars['--av-badge-catalog-text']).toBe(THEME_CATALOG.light.badgeCatalogText)
  })

  it('derives Arco config from tokens', () => {
    const cfg = getArcoThemeConfig('dark')
    expect(cfg.colorPrimary).toBe(THEME_TOKENS.dark.accentBlue)
    expect(cfg.colorBgLayout).toBe(THEME_TOKENS.dark.bgPrimary)
  })
})
