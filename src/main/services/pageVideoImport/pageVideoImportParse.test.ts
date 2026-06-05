import { describe, expect, it } from 'vitest'
import { buildBatchItemBody, parseCreateBody } from './pageVideoImportParse'
import { resolvePageVideoFormat } from '@/shared/pageVideoFormatPolicy'

describe('parseCreateBody', () => {
  it('requires url', () => {
    expect(() => parseCreateBody({})).toThrow('INVALID_REQUEST')
  })

  it('resolves bilibili format when platform set and format omitted', () => {
    const p = parseCreateBody({
      url: 'https://www.bilibili.com/video/BV1xx411c7mD',
      platform: 'bilibili',
      cookiesFromBrowser: 'none'
    })
    expect(p.format).toBe(resolvePageVideoFormat('bilibili'))
    expect(p.format).toContain('1080')
  })

  it('forces cookiesFromBrowser none when cookieHeader set', () => {
    const p = parseCreateBody({
      url: 'https://www.bilibili.com/video/BV1xx411c7mD',
      cookieHeader: 'SESSDATA=abc',
      cookiesFromBrowser: 'edge'
    })
    expect(p.cookiesFromBrowser).toBe('none')
    expect(p.cookieHeader).toBe('SESSDATA=abc')
  })

  it('strips cookies for public YouTube imports', () => {
    const p = parseCreateBody({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      platform: 'youtube',
      cookieHeader: 'PREF=1; VISITOR_INFO1_LIVE=x',
      cookiesFromBrowser: 'edge'
    })
    expect(p.cookieHeader).toBeUndefined()
    expect(p.cookiesFromBrowser).toBe('none')
  })

  it('rejects replace with warning and import_copy policy', () => {
    const p = parseCreateBody({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      duplicatePolicy: 'replace'
    })
    expect(p.duplicatePolicy).toBe('import_copy')
    expect(p.parseWarnings).toContain('REPLACE_NOT_IMPLEMENTED')
  })

  it('applies formatPreset when format omitted', () => {
    const p = parseCreateBody({
      url: 'https://www.youtube.com/watch?v=x',
      formatPreset: 'audio_only'
    })
    expect(p.format).toBe('bestaudio/best')
    expect(p.formatPreset).toBe('audio_only')
  })

  it('passes writeSubs options through', () => {
    const p = parseCreateBody({
      url: 'https://www.youtube.com/watch?v=x',
      options: { writeSubs: true, subtitleLangs: ['zh-Hans', 'en'] }
    })
    expect(p.options?.writeSubs).toBe(true)
    expect(p.options?.subtitleLangs).toEqual(['zh-Hans', 'en'])
  })

  it('rejects cookiesFile and cookieHeader together', () => {
    expect(() =>
      parseCreateBody({
        url: 'https://www.bilibili.com/video/BV1',
        platform: 'bilibili',
        cookiesFile: '/tmp/c.txt',
        cookieHeader: 'a=1'
      })
    ).toThrow('INVALID_REQUEST')
  })
})

describe('buildBatchItemBody', () => {
  it('inherits batch cookieHeader and platform format', () => {
    const batch = {
      platform: 'bilibili',
      cookieHeader: 'SESSDATA=batch',
      cookiesFromBrowser: 'none'
    }
    const item = { url: 'https://www.bilibili.com/video/BV1' }
    const body = buildBatchItemBody(batch, item, null)
    const p = parseCreateBody(body)
    expect(p.cookieHeader).toBe('SESSDATA=batch')
    expect(p.format).toBe(resolvePageVideoFormat('bilibili'))
  })

  it('item format overrides batch', () => {
    const batch = { platform: 'youtube', format: 'best' }
    const item = { url: 'https://youtu.be/x', format: 'worst' }
    const p = parseCreateBody(buildBatchItemBody(batch, item, undefined))
    expect(p.format).toBe('worst')
  })

  it('does not inject defaultFormat when batch format omitted', () => {
    const batch = { platform: 'bilibili', cookieHeader: 'x=1' }
    const item = { url: 'https://www.bilibili.com/video/BV2' }
    const raw = buildBatchItemBody(batch, item, null)
    expect(raw.format).toBeUndefined()
    expect(parseCreateBody(raw).format).toContain('1080')
  })
})
