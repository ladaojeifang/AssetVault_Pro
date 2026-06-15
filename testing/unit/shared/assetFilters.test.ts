import { describe, expect, it } from 'vitest'
import {
  hasActiveAssetFilters,
  hasActiveAssetListQuery,
  normalizeExtensionFilter,
  formatExtensionFilterLabel
} from '@/shared/assetFilters'

describe('normalizeExtensionFilter', () => {
  it('strips dot and lowercases', () => {
    expect(normalizeExtensionFilter('.PNG')).toBe('png')
    expect(normalizeExtensionFilter('  JPG  ')).toBe('jpg')
  })

  it('allows compound extensions', () => {
    expect(normalizeExtensionFilter('tar.gz')).toBe('tar.gz')
  })

  it('rejects empty or invalid', () => {
    expect(normalizeExtensionFilter('')).toBeNull()
    expect(normalizeExtensionFilter('..')).toBeNull()
    expect(normalizeExtensionFilter('png!')).toBeNull()
  })
})

describe('formatExtensionFilterLabel', () => {
  it('prefixes dot once', () => {
    expect(formatExtensionFilterLabel('png')).toBe('.png')
    expect(formatExtensionFilterLabel('.png')).toBe('.png')
  })
})

describe('hasActiveAssetFilters', () => {
  it('detects extension filter', () => {
    expect(
      hasActiveAssetFilters({
        colorBucket: null,
        sizePreset: null,
        fileSizeMinMb: null,
        fileSizeMaxMb: null,
        datePreset: null,
        extension: 'png'
      })
    ).toBe(true)
  })
})

describe('hasActiveAssetListQuery', () => {
  it('includes extension in active query', () => {
    expect(
      hasActiveAssetListQuery({
        extension: 'png',
        colorBucket: null,
        sizePreset: null,
        fileSizeMinMb: null,
        fileSizeMaxMb: null,
        datePreset: null
      })
    ).toBe(true)
  })
})
