import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExrDecodeImage } from 'exrs'

const mockDecode = vi.fn()
const mockEnsureInit = vi.fn()
const mockFindSub = vi.fn()
const mockBuildRgba = vi.fn()
const mockRasterize = vi.fn()
const mockNapiAvailable = vi.fn()

vi.mock('@main/services/exrExrsDecoder', () => ({
  decodeExrFileCached: (...args: unknown[]) => mockDecode(...args),
  ensureExrsInitialized: (...args: unknown[]) => mockEnsureInit(...args),
  findExrsSubLayer: (...args: unknown[]) => mockFindSub(...args),
  buildRgba8FromExrsSubLayerCached: (...args: unknown[]) => mockBuildRgba(...args)
}))

vi.mock('@main/utils/exrRaster', () => ({
  rasterizeExrPreviewJpeg: (...args: unknown[]) => mockRasterize(...args)
}))

vi.mock('@main/utils/exrMetadata', () => ({
  estimateNapiChannelControlAvailable: (...args: unknown[]) => mockNapiAvailable(...args)
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    statSync: vi.fn(() => ({ size: 1024 }))
  }
})

vi.mock('@napi-rs/image', () => ({
  Transformer: {
    fromRgbaPixels: vi.fn(() => ({
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]))
    }))
  },
  ResizeFit: { Inside: 'inside' }
}))

import { renderExrPreviewJpeg } from '@main/services/exrPreviewRender'

const BASE_REQ = {
  layerName: 'albedo',
  channels: { r: true, g: true, b: true, a: false },
  exposure: 1,
  maxEdge: 512
} as const

const MOCK_IMAGE = { width: 960, height: 540, layers: [] } as unknown as ExrDecodeImage

describe('renderExrPreviewJpeg failure reasons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureInit.mockResolvedValue(undefined)
    mockDecode.mockResolvedValue(MOCK_IMAGE)
    mockNapiAvailable.mockReturnValue(false)
    mockRasterize.mockResolvedValue(null)
  })

  it('returns decode_failed when pixel build throws for non-default layer', async () => {
    mockFindSub.mockReturnValue({ displayName: 'N' })
    mockBuildRgba.mockImplementation(() => {
      throw new Error('no pixel data')
    })

    const result = await renderExrPreviewJpeg('/fake/layer.exr', {
      ...BASE_REQ,
      layerName: 'N'
    })

    expect(result.failureReason).toBe('decode_failed')
    expect(result.jpeg).toBeNull()
    expect(result.error).toContain('像素解码失败')
    expect(mockRasterize).not.toHaveBeenCalled()
  })

  it('falls back to ffmpeg when exrs fails for RGBA layer', async () => {
    mockEnsureInit.mockRejectedValue(new Error('wasm init failed'))
    mockNapiAvailable.mockReturnValue(false)
    mockRasterize.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]))

    const result = await renderExrPreviewJpeg('/fake/layer.exr', {
      layerName: 'RGBA',
      channels: { r: true, g: true, b: true, a: false },
      exposure: 1,
      maxEdge: 512
    })

    expect(result.jpeg).not.toBeNull()
    expect(mockRasterize).toHaveBeenCalledWith('/fake/layer.exr', 512, 88)
    expect(result.displayMode).toBe('hdr')
  })

  it('returns layer_missing without fallback for non-RGBA unknown layer', async () => {
    mockFindSub.mockReturnValue(null)

    const result = await renderExrPreviewJpeg('/fake/layer.exr', BASE_REQ)

    expect(result.failureReason).toBe('layer_missing')
    expect(mockRasterize).not.toHaveBeenCalled()
  })

  it('returns jpeg on successful exrs path', async () => {
    mockFindSub.mockReturnValue({ displayName: 'albedo' })
    mockBuildRgba.mockReturnValue({
      rgba8: Buffer.alloc(960 * 540 * 4, 128),
      width: 960,
      height: 540,
      displayMode: 'hdr'
    })

    const result = await renderExrPreviewJpeg('/fake/layer.exr', BASE_REQ)

    expect(result.jpeg).not.toBeNull()
    expect(result.displayMode).toBe('hdr')
    expect(result.failureReason).toBeUndefined()
  })
})
