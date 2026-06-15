import '../../../helpers/registerElectronMock'
import { describe, expect, it } from 'vitest'
import { parseAssetQueryInput } from '@main/api/handlers/asset'

describe('parseAssetQueryInput', () => {
  it('parses typeFilters from comma string or array', () => {
    expect(parseAssetQueryInput({ typeFilters: '__sys:image,cat-uuid' }).typeFilters).toEqual([
      '__sys:image',
      'cat-uuid'
    ])
    expect(
      parseAssetQueryInput({ typeFilterIds: ['__sys:font', 'other-cat'] }).typeFilters
    ).toEqual(['__sys:font', 'other-cat'])
  })

  it('keeps legacy fileType and categories for backward compatibility', () => {
    expect(parseAssetQueryInput({ fileType: 'video' }).fileType).toBe('video')
    expect(parseAssetQueryInput({ categories: 'a,b' }).categories).toEqual(['a', 'b'])
    expect(parseAssetQueryInput({ categoryIds: ['c'] }).categories).toEqual(['c'])
  })

  it('normalizes extension filter', () => {
    expect(parseAssetQueryInput({ extension: '.PNG' }).extension).toBe('png')
    expect(parseAssetQueryInput({ extension: 'tar.gz' }).extension).toBe('tar.gz')
    expect(parseAssetQueryInput({ extension: '..' }).extension).toBeUndefined()
  })
})
