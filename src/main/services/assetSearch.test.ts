import { describe, expect, it } from 'vitest'
import { tokenizeSearchQuery } from './assetSearch'

describe('tokenizeSearchQuery', () => {
  it('preserves underscores in filename-style queries', () => {
    expect(tokenizeSearchQuery('c09_tlc04_camera001_mapsG_stop.max')).toEqual([
      'c09_tlc04_camera001_mapsg_stop.max'
    ])
  })

  it('splits multi-word queries for AND semantics', () => {
    expect(tokenizeSearchQuery('camera stop')).toEqual(['camera', 'stop'])
  })

  it('matches short substring tokens', () => {
    expect(tokenizeSearchQuery('stop')).toEqual(['stop'])
  })
})
