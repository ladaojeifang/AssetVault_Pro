import { describe, expect, it } from 'vitest'
import {
  buildMp4FormatChain,
  resolveFormatFromPreset,
  resolvePageVideoFormat
} from '@/shared/pageVideoFormatPolicy'

describe('resolvePageVideoFormat', () => {
  it('uses bilibili 1080p DASH preset by default', () => {
    const f = resolvePageVideoFormat('bilibili')
    expect(f).toContain('bestvideo')
    expect(f).toContain('1080')
    expect(f).not.toMatch(/^bv\*\+ba/)
  })

  it('respects explicit format override', () => {
    expect(resolvePageVideoFormat('bilibili', 'bestaudio/best')).toBe('bestaudio/best')
  })

  it('applies 1080p_mp4 preset without requiring source mp4 (YouTube DASH)', () => {
    const f = resolvePageVideoFormat('youtube', undefined, { formatPreset: '1080p_mp4' })
    expect(f).toContain('[height<=1080]')
    expect(f).toContain('bv*')
    expect(f).not.toContain('[ext=mp4]')
  })

  it('youtube platform default matches height-capped merge chain', () => {
    expect(resolvePageVideoFormat('youtube')).toBe(buildMp4FormatChain(1080))
  })

  it('applies audio_only preset', () => {
    expect(
      resolvePageVideoFormat('bilibili', undefined, { formatPreset: 'audio_only' })
    ).toBe('bestaudio/best')
  })

  it('buildMp4FormatChain respects custom height', () => {
    expect(buildMp4FormatChain(2160)).toContain('[height<=2160]')
  })

  it('resolveFormatFromPreset returns null for best', () => {
    expect(resolveFormatFromPreset('best')).toBeNull()
  })
})
