import { describe, expect, it, vi } from 'vitest'
import type { ExrDecodeLayer } from 'exrs'
import type { ExrChannelToggle } from '@/shared/exrTypes'
import {
  buildRgba8FromExrsSubLayer,
  buildRgba8FromExrsSubLayerCached,
  exrsRgbaCacheSizeForTests,
  type ExrsSubLayer
} from '@/main/services/exrExrsDecoder'

vi.mock('fs', () => ({
  statSync: vi.fn(() => ({ mtimeMs: 1000 })),
  readFileSync: vi.fn(() => Buffer.alloc(0))
}))

function mockNormalLayer(): ExrsSubLayer {
  const w = 2
  const h = 2
  const pixels = new Float32Array([
    // px0 bg
    0, 0, 0,
    // px1 normal-ish
    0.5, -0.5, 0.5,
    // px2
    -1, 0, 0,
    // px3
    0, 1, 0
  ])

  const layer = {
    channelNamesAlphabetical: ['N.B', 'N.G', 'N.R'],
    getInterleavedPixels: (names: readonly string[]) => {
      if (names.join(',') !== 'N.R,N.G,N.B') return null
      return pixels
    }
  } as unknown as ExrDecodeLayer

  return {
    displayName: 'N',
    channelSuffixes: ['R', 'G', 'B'],
    fullChannelNames: ['N.R', 'N.G', 'N.B'],
    layer,
    displayMode: 'vector'
  }
}

const ALL_RGB: ExrChannelToggle = { r: true, g: true, b: true, a: false }

describe('buildRgba8FromExrsSubLayer', () => {
  it('maps vector normals with black zero background', () => {
    const { rgba8, displayMode, width, height } = buildRgba8FromExrsSubLayer(
      mockNormalLayer(),
      ALL_RGB,
      1,
      2,
      2,
      2048
    )

    expect(displayMode).toBe('vector')
    expect(width).toBe(2)
    expect(height).toBe(2)

    // background pixel black
    expect(rgba8[0]).toBe(0)
    expect(rgba8[1]).toBe(0)
    expect(rgba8[2]).toBe(0)

    // pixel 1: G=-0.5 → ~64 (rgba layout: R,G,B,A per pixel)
    expect(rgba8[5]).toBe(64)
    expect(rgba8[4]).toBe(191) // R=0.5
  })

  it('refines P world-position samples to data mode', () => {
    const layer = {
      channelNamesAlphabetical: ['P.R', 'P.G', 'P.B'],
      getInterleavedPixels: () => new Float32Array([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200])
    } as unknown as ExrDecodeLayer

    const sub: ExrsSubLayer = {
      displayName: 'P',
      channelSuffixes: ['R', 'G', 'B'],
      fullChannelNames: ['P.R', 'P.G', 'P.B'],
      layer,
      displayMode: 'vector'
    }

    const { displayMode, rgba8 } = buildRgba8FromExrsSubLayer(sub, ALL_RGB, 1, 2, 2, 2048)
    expect(displayMode).toBe('data')
    // min sample maps to 0, max sample maps to 255
    expect(rgba8[0]).toBe(0)
    expect(rgba8[14]).toBe(255) // last pixel B channel (1200 = max)
  })
})

describe('buildRgba8FromExrsSubLayerCached', () => {
  it('returns cached rgba on repeated calls', () => {
    const layer = {
      channelNamesAlphabetical: ['R', 'G', 'B'],
      getInterleavedPixels: () => new Float32Array([0.5, -0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    } as unknown as ExrDecodeLayer

    const sub: ExrsSubLayer = {
      displayName: 'N',
      channelSuffixes: ['R', 'G', 'B'],
      fullChannelNames: ['R', 'G', 'B'],
      layer,
      displayMode: 'vector'
    }

    const first = buildRgba8FromExrsSubLayerCached('/fake.exr', sub, ALL_RGB, 1, 2, 2, 2048)
    const second = buildRgba8FromExrsSubLayerCached('/fake.exr', sub, ALL_RGB, 1, 2, 2, 2048)

    expect(second.rgba8).toBe(first.rgba8)
    expect(exrsRgbaCacheSizeForTests()).toBeGreaterThan(0)
  })
})

describe('listExrsSubLayers cache', () => {
  it('returns the same array instance for repeated calls', async () => {
    const { listExrsSubLayers } = await import('@/main/services/exrExrsDecoder')
    const image = { layers: [] } as import('exrs').ExrDecodeImage
    expect(listExrsSubLayers(image)).toBe(listExrsSubLayers(image))
  })

  it('splits single dotted channel into a named sub-layer', async () => {
    const { listExrsSubLayers } = await import('@/main/services/exrExrsDecoder')
    const layer = {
      name: null,
      channelNamesAlphabetical: ['depth.Z']
    } as unknown as ExrDecodeLayer
    const subs = listExrsSubLayers({ layers: [layer] } as import('exrs').ExrDecodeImage)
    expect(subs).toHaveLength(1)
    expect(subs[0]?.displayName).toBe('depth')
    expect(subs[0]?.channelSuffixes).toEqual(['Z'])
    expect(subs[0]?.fullChannelNames).toEqual(['depth.Z'])
    expect(subs[0]?.displayMode).toBe('data')
  })
})
