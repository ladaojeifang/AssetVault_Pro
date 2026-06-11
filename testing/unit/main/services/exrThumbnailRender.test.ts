import { describe, expect, it, vi } from 'vitest'
import type { ExrDecodeImage } from 'exrs'
import { pickExrThumbnailLayerName } from '@main/services/exrExrsDecoder'

function mockFlatAovImage(channelNames: string[]): ExrDecodeImage {
  return {
    width: 64,
    height: 64,
    layers: [
      {
        name: null,
        channelNamesAlphabetical: channelNames,
        getInterleavedPixels: () => new Float32Array(0)
      }
    ]
  } as unknown as ExrDecodeImage
}

describe('pickExrThumbnailLayerName', () => {
  it('prefers RGBA when present', () => {
    const image = mockFlatAovImage(['A', 'B', 'G', 'R', 'albedo.R', 'albedo.G', 'albedo.B'])
    expect(pickExrThumbnailLayerName(image)).toBe('RGBA')
  })

  it('prefers beauty over other AOVs', () => {
    const image = mockFlatAovImage(['N.R', 'N.G', 'N.B', 'beauty.R', 'beauty.G', 'beauty.B'])
    expect(pickExrThumbnailLayerName(image)).toBe('beauty')
  })

  it('falls back to first HDR RGB layer', () => {
    const image = mockFlatAovImage(['N.R', 'N.G', 'N.B', 'albedo.R', 'albedo.G', 'albedo.B'])
    expect(pickExrThumbnailLayerName(image)).toBe('albedo')
  })
})

describe('renderExrThumbnailWebp', () => {
  it('falls back to napi/ffmpeg when exrs fails', async () => {
    vi.doMock('@main/services/exrExrsDecoder', () => ({
      ensureExrsInitialized: vi.fn().mockRejectedValue(new Error('wasm init failed')),
      decodeExrFileCached: vi.fn(),
      pickExrThumbnailLayerName: vi.fn(),
      findExrsSubLayer: vi.fn(),
      buildRgba8FromExrsSubLayer: vi.fn()
    }))

    const mockRaster = vi.fn().mockResolvedValue(Buffer.from('RIFF....webp'))
    vi.doMock('@main/utils/exrRaster', () => ({
      rasterizeExrToWebpBuffer: mockRaster
    }))

    vi.resetModules()
    const { renderExrThumbnailWebp } = await import('@main/services/exrThumbnailRender')
    const buf = await renderExrThumbnailWebp('/fake.exr', 256, 80)

    expect(mockRaster).toHaveBeenCalledWith('/fake.exr', 256, 80)
    expect(buf?.toString('ascii', 0, 4)).toBe('RIFF')
  })
})
