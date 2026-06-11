import { describe, expect, it } from 'vitest'
import {
  isDeferredThumbnailAsset,
  shouldRenderThumbnailImage,
  shouldRetryThumbnailWhileEmpty
} from '@/shared/asyncThumbnailAsset'

describe('asyncThumbnailAsset', () => {
  it('recognizes deferred 3D, DCC, and text types', () => {
    expect(isDeferredThumbnailAsset('3d', 'glb')).toBe(true)
    expect(isDeferredThumbnailAsset('3d', 'c4d')).toBe(true)
    expect(isDeferredThumbnailAsset('code', 'json')).toBe(true)
    expect(isDeferredThumbnailAsset('document', 'md')).toBe(true)
    expect(isDeferredThumbnailAsset('3d', 'usd')).toBe(false)
    expect(isDeferredThumbnailAsset('document', 'pdf')).toBe(false)
  })

  it('retries grid fetch only for deferred assets without thumb', () => {
    expect(shouldRetryThumbnailWhileEmpty('3d', 'fbx', false)).toBe(true)
    expect(shouldRetryThumbnailWhileEmpty('3d', 'blend', false)).toBe(true)
    expect(shouldRetryThumbnailWhileEmpty('document', 'txt', false)).toBe(true)
    expect(shouldRetryThumbnailWhileEmpty('3d', 'fbx', true)).toBe(false)
    expect(shouldRetryThumbnailWhileEmpty('audio', 'mp3', false)).toBe(false)
  })

  it('shows thumbnail slot for deferred assets even before hasThumbnail', () => {
    expect(shouldRenderThumbnailImage('document', 'md', false)).toBe(true)
    expect(shouldRenderThumbnailImage('design', 'psd', false)).toBe(false)
  })
})
