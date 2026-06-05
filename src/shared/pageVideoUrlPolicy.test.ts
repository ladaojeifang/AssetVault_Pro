import { describe, expect, it } from 'vitest'
import {
  assertPageVideoUrl,
  isDirectMediaUrl,
  isPageVideoWorkUrl,
  parseHttpPageUrl
} from './pageVideoUrlPolicy'

describe('pageVideoUrlPolicy', () => {
  it('accepts youtube watch URLs for pageVideoImport', () => {
    const u = assertPageVideoUrl('https://www.youtube.com/watch?v=abc123')
    expect(u.hostname).toBe('www.youtube.com')
  })

  it('rejects direct mp4 URLs for pageVideoImport', () => {
    expect(() => assertPageVideoUrl('https://cdn.example.com/video.mp4')).toThrow(
      'PAGE_VIDEO_NOT_SUPPORTED'
    )
  })

  it('rejects image CDN URLs for pageVideoImport', () => {
    expect(() =>
      assertPageVideoUrl(
        'https://img.pc520.net/wp-content/uploads/2025/11/2025113023042886.jpg'
      )
    ).toThrow('PAGE_VIDEO_NOT_SUPPORTED')
  })

  it('isPageVideoWorkUrl distinguishes work page vs direct', () => {
    expect(isPageVideoWorkUrl('https://www.youtube.com/watch?v=abc')).toBe(true)
    expect(isPageVideoWorkUrl('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(true)
    expect(isPageVideoWorkUrl('https://cdn.example.com/video.mp4')).toBe(false)
    expect(
      isPageVideoWorkUrl(
        'https://img.pc520.net/wp-content/uploads/2025/11/2025113023042886.jpg'
      )
    ).toBe(false)
    expect(isPageVideoWorkUrl('https://www.pc528.net/article/123')).toBe(false)
    expect(isPageVideoWorkUrl('not-a-url')).toBe(false)
  })

  it('treats common image extensions as direct media', () => {
    expect(isDirectMediaUrl(new URL('https://cdn.example.com/a.webp'))).toBe(true)
    expect(isDirectMediaUrl(new URL('https://cdn.example.com/a.JPG?x=1'))).toBe(true)
  })

  it('rejects localhost SSRF', () => {
    expect(() => parseHttpPageUrl('http://127.0.0.1/video')).toThrow('INVALID_REQUEST')
  })

  it('detects bilivideo CDN', () => {
    const u = new URL('https://upos-sz-mirrorhw.bilivideo.com/upgcxcode/01.mp4')
    expect(isDirectMediaUrl(u)).toBe(true)
  })
})
