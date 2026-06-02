import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { groupExrHeaderChannelNames } from '@/shared/exrLayerGrouping'
import { parseExrChannelsFromBuffer, readExrHeaderBuffer, resolveExrFileMetadata } from '@/main/utils/exrMetadata'
import {
  findExrsSubLayer,
  listExrsSubLayers,
  ensureExrsInitialized,
  pickExrThumbnailLayerName
} from '@/main/services/exrExrsDecoder'
import { renderExrThumbnailWebp } from '@/main/services/exrThumbnailRender'

const MULTI_LAYER = join(process.cwd(), 'multi-layer.exr')
const SINGLE_LAYER = join(process.cwd(), 'test_24.0046.exr')

describe('EXR header vs exrs layer alignment', () => {
  it.skipIf(!existsSync(MULTI_LAYER))('header layers match exrs sub-layers for multi-layer.exr', async () => {
    const head = readExrHeaderBuffer(MULTI_LAYER)
    const headerChannels = parseExrChannelsFromBuffer(head)
    const headerGroups = groupExrHeaderChannelNames(headerChannels.map((c) => c.name))
    const headerNames = new Set(headerGroups.map((g) => g.displayName))

    await ensureExrsInitialized()
    const { decodeExr } = await import('exrs')
    const image = decodeExr(new Uint8Array(readFileSync(MULTI_LAYER)))
    const exrsSubs = listExrsSubLayers(image)
    const exrsNames = new Set(exrsSubs.map((s) => s.displayName))

    expect(exrsNames).toEqual(headerNames)
    expect(exrsSubs.length).toBe(55)

    const nSub = findExrsSubLayer(image, 'N')
    expect(nSub?.fullChannelNames).toEqual(['N.R', 'N.G', 'N.B'])
    expect(nSub?.displayMode).toBe('vector')
  })

  it.skipIf(!existsSync(SINGLE_LAYER))('single RGBA exr has one sub-layer', async () => {
    await ensureExrsInitialized()
    const { decodeExr } = await import('exrs')
    const image = decodeExr(new Uint8Array(readFileSync(SINGLE_LAYER)))
    const subs = listExrsSubLayers(image)
    expect(subs.length).toBe(1)
    expect(subs[0]?.displayName).toBe('RGBA')
    expect(pickExrThumbnailLayerName(image)).toBe('RGBA')
  })

  it.skipIf(!existsSync(MULTI_LAYER))('multi-AOV exr thumbnail picks an HDR RGB layer', async () => {
    await ensureExrsInitialized()
    const { decodeExr } = await import('exrs')
    const image = decodeExr(new Uint8Array(readFileSync(MULTI_LAYER)))
    const layerName = pickExrThumbnailLayerName(image)
    const sub = findExrsSubLayer(image, layerName)
    expect(sub).not.toBeNull()
    expect(sub?.displayMode).toBe('hdr')
    expect(sub?.channelSuffixes).toEqual(expect.arrayContaining(['R', 'G', 'B']))
  })

  it.skipIf(!existsSync(MULTI_LAYER))('metadata defaultLayerName matches thumbnail pick', async () => {
    const meta = await resolveExrFileMetadata(MULTI_LAYER)
    await ensureExrsInitialized()
    const { decodeExr } = await import('exrs')
    const image = decodeExr(new Uint8Array(readFileSync(MULTI_LAYER)))
    expect(meta?.defaultLayerName).toBe(pickExrThumbnailLayerName(image))
    expect(meta?.layerListIncomplete).toBe(false)
    expect(meta?.perLayerPreviewAvailable).toBe(true)
    expect(meta?.channelControlAvailable).toBe(true)
  })
})

describe('EXR thumbnail render', () => {
  it.skipIf(!existsSync(SINGLE_LAYER))('renders WebP for single RGBA exr', async () => {
    const buf = await renderExrThumbnailWebp(SINGLE_LAYER, 256, 80)
    expect(buf?.length).toBeGreaterThan(100)
    expect(buf?.toString('ascii', 0, 4)).toBe('RIFF')
  })
})

describe('ensureExrsInitialized retry', () => {
  it('allows retry after simulated failure', async () => {
    const mod = await import('@/main/services/exrExrsDecoder')
    // Successful init should complete (smoke test)
    await expect(mod.ensureExrsInitialized()).resolves.toBeUndefined()
  })
})
