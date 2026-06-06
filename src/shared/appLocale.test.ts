import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_LOCALE, normalizeAppLocale } from './appLocale'
import { normalizeAppPreferences } from './appPreferences'

describe('appLocale', () => {
  it('defaults to zh-CN', () => {
    expect(DEFAULT_APP_LOCALE).toBe('zh-CN')
    expect(normalizeAppLocale(undefined)).toBe('zh-CN')
    expect(normalizeAppLocale('fr-FR')).toBe('zh-CN')
  })

  it('accepts en-US', () => {
    expect(normalizeAppLocale('en-US')).toBe('en-US')
  })

  it('is stored in app preferences', () => {
    expect(normalizeAppPreferences({ locale: 'en-US' }).locale).toBe('en-US')
    expect(normalizeAppPreferences({}).locale).toBe('zh-CN')
  })
})
