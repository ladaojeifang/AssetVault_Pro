import { describe, expect, it } from 'vitest'
import {
  groupExrChannelFullNames,
  isFlatMultiAovChannelLayout,
  parseExrChannelFullName,
  partitionExrLayerChannelSuffixes,
  sortExrChannelSuffixes
} from './exrLayerGrouping'
import { EXR_DEFAULT_LAYER_NAME } from './exrTypes'

describe('parseExrChannelFullName', () => {
  it('splits layer.suffix dotted names', () => {
    expect(parseExrChannelFullName('albedo.R')).toEqual({ layerKey: 'albedo', suffix: 'R' })
    expect(parseExrChannelFullName('N.G')).toEqual({ layerKey: 'N', suffix: 'G' })
  })

  it('treats bare names as default layer suffix', () => {
    expect(parseExrChannelFullName('R')).toEqual({ layerKey: '', suffix: 'R' })
  })
})

describe('sortExrChannelSuffixes', () => {
  it('orders R/G/B/A before other suffixes', () => {
    expect(sortExrChannelSuffixes(['B', 'A', 'G', 'R'])).toEqual(['R', 'G', 'B', 'A'])
    expect(sortExrChannelSuffixes(['Z', 'Y', 'X'])).toEqual(['X', 'Y', 'Z'])
  })
})

describe('isFlatMultiAovChannelLayout', () => {
  it('detects Arnold-style flat AOV lists', () => {
    expect(isFlatMultiAovChannelLayout(['R', 'G', 'B', 'albedo.R', 'albedo.G'])).toBe(true)
    expect(isFlatMultiAovChannelLayout(['R', 'G', 'B', 'A'])).toBe(false)
    expect(isFlatMultiAovChannelLayout(['single.R'])).toBe(true)
    expect(isFlatMultiAovChannelLayout(['depth.Z'])).toBe(true)
  })
})

describe('partitionExrLayerChannelSuffixes', () => {
  it('separates standard and custom channel suffixes', () => {
    const { toggleable, custom } = partitionExrLayerChannelSuffixes(['R', 'G', 'coverage'])
    expect(toggleable.map((t) => t.suffix)).toEqual(['R', 'G'])
    expect(custom).toEqual(['coverage'])
  })
})

describe('groupExrChannelFullNames', () => {
  it('groups flat multi-AOV channel names into layers', () => {
    const groups = groupExrChannelFullNames([
      'R',
      'G',
      'B',
      'A',
      'N.R',
      'N.G',
      'N.B',
      'albedo.R',
      'albedo.G',
      'albedo.B'
    ])

    const names = groups.map((g) => g.displayName)
    expect(names[0]).toBe(EXR_DEFAULT_LAYER_NAME)
    expect(names.slice(1).sort()).toEqual(['N', 'albedo'])

    const nLayer = groups.find((g) => g.displayName === 'N')!
    expect(nLayer.channelSuffixes).toEqual(['R', 'G', 'B'])
    expect(nLayer.fullChannelNames).toEqual(['N.R', 'N.G', 'N.B'])
  })

  it('matches header parser grouping for multi-layer.exr channel list sample', () => {
    const sample = [
      'A',
      'B',
      'G',
      'R',
      'N.B',
      'N.G',
      'N.R',
      'crypto_asset.B',
      'crypto_asset.G',
      'crypto_asset.R',
      'albedo.B',
      'albedo.G',
      'albedo.R'
    ]
    const groups = groupExrChannelFullNames(sample)
    expect(groups.find((g) => g.displayName === 'N')?.fullChannelNames).toEqual([
      'N.R',
      'N.G',
      'N.B'
    ])
    expect(groups.find((g) => g.displayName === 'crypto_asset')?.displayName).toBe('crypto_asset')
  })

  it('groups single dotted data pass into its own layer', () => {
    const groups = groupExrChannelFullNames(['depth.Z'])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayName).toBe('depth')
    expect(groups[0]?.channelSuffixes).toEqual(['Z'])
    expect(groups[0]?.fullChannelNames).toEqual(['depth.Z'])
  })
})
