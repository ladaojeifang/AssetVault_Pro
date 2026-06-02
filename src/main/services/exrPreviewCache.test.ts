import { describe, expect, it } from 'vitest'
import {
  exrPreviewCacheSizeForTests,
  storeExrPreviewJpeg
} from '@/main/services/exrPreviewCache'

describe('exrPreviewCache', () => {
  it('stores jpeg and returns preview protocol URL', () => {
    const before = exrPreviewCacheSizeForTests()
    const url = storeExrPreviewJpeg(Buffer.from([0xff, 0xd8, 0xff, 0x00]))
    expect(url.startsWith('assetvault-exr-preview://cache/')).toBe(true)
    expect(url.endsWith('.jpg')).toBe(true)
    expect(exrPreviewCacheSizeForTests()).toBe(before + 1)
  })
})
