import { describe, expect, it } from 'vitest'
import {
  detectExrAovDisplayMode,
  exposureAppliesToDisplayMode,
  isVectorBackgroundZero,
  layerNameMatchesDataKeyword,
  mapCryptoSample,
  mapVectorSample,
  refineExrAovDisplayMode,
  tonemapHdrSample
} from './exrAovDisplay'

describe('layerNameMatchesDataKeyword', () => {
  it('matches exact and segmented names', () => {
    expect(layerNameMatchesDataKeyword('id', 'id')).toBe(true)
    expect(layerNameMatchesDataKeyword('crypto_id', 'id')).toBe(true)
    expect(layerNameMatchesDataKeyword('shadow_diff', 'shadow')).toBe(true)
    expect(layerNameMatchesDataKeyword('volume_z', 'volume_z')).toBe(true)
  })

  it('does not match keywords inside unrelated words', () => {
    expect(layerNameMatchesDataKeyword('bidirectional', 'id')).toBe(false)
    expect(layerNameMatchesDataKeyword('indirect', 'id')).toBe(false)
    expect(layerNameMatchesDataKeyword('albedo', 'ao')).toBe(false)
  })
})

describe('detectExrAovDisplayMode', () => {
  it('classifies common VFX AOV layers', () => {
    expect(detectExrAovDisplayMode('N', ['R', 'G', 'B'])).toBe('vector')
    expect(detectExrAovDisplayMode('albedo', ['R', 'G', 'B'])).toBe('hdr')
    expect(detectExrAovDisplayMode('Z', ['R', 'G', 'B'])).toBe('data')
    expect(detectExrAovDisplayMode('crypto_asset', ['R', 'G', 'B'])).toBe('crypto')
    expect(detectExrAovDisplayMode('motionvector', ['R', 'G', 'B'])).toBe('vector')
  })

  it('does not misclassify beauty passes as data AOV', () => {
    expect(detectExrAovDisplayMode('bidirectional', ['R', 'G', 'B'])).toBe('hdr')
    expect(detectExrAovDisplayMode('indirect', ['R', 'G', 'B'])).toBe('hdr')
    expect(detectExrAovDisplayMode('diffuse', ['R', 'G', 'B'])).toBe('hdr')
    expect(detectExrAovDisplayMode('abnormal', ['R', 'G', 'B'])).toBe('hdr')
  })

  it('classifies ID layer as data', () => {
    expect(detectExrAovDisplayMode('ID', ['R', 'G', 'B'])).toBe('data')
  })
})

describe('refineExrAovDisplayMode', () => {
  it('downgrades vector to data when samples exceed unit range', () => {
    expect(refineExrAovDisplayMode('vector', -0.5, 0.9)).toBe('vector')
    expect(refineExrAovDisplayMode('vector', -2, 5000)).toBe('data')
    expect(refineExrAovDisplayMode('crypto', 0, 1)).toBe('crypto')
  })
})

describe('mapVectorSample', () => {
  it('maps [-1,1] to [0,255]', () => {
    expect(mapVectorSample(-1)).toBe(0)
    expect(mapVectorSample(0)).toBe(128)
    expect(mapVectorSample(1)).toBe(255)
  })
})

describe('mapCryptoSample', () => {
  it('maps 0-1 hash values directly', () => {
    expect(mapCryptoSample(0)).toBe(0)
    expect(mapCryptoSample(0.5)).toBe(128)
    expect(mapCryptoSample(1)).toBe(255)
  })
})

describe('isVectorBackgroundZero', () => {
  it('detects empty background normals', () => {
    expect(isVectorBackgroundZero(0, 0, 0)).toBe(true)
    expect(isVectorBackgroundZero(0.5, 0, 0)).toBe(false)
  })
})

describe('tonemapHdrSample', () => {
  it('applies reinhard with exposure', () => {
    expect(tonemapHdrSample(1, 1)).toBe(128)
    expect(tonemapHdrSample(-1, 1)).toBe(0)
  })
})

describe('exposureAppliesToDisplayMode', () => {
  it('only enables exposure for hdr', () => {
    expect(exposureAppliesToDisplayMode('hdr')).toBe(true)
    expect(exposureAppliesToDisplayMode('vector')).toBe(false)
    expect(exposureAppliesToDisplayMode('data')).toBe(false)
    expect(exposureAppliesToDisplayMode('crypto')).toBe(false)
  })
})
