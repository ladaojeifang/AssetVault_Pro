import { describe, expect, it } from 'vitest'
import {
  isDeferredThumbnailAsset,
  shouldRenderThumbnailImage,
  shouldRetryThumbnailWhileEmpty
} from '@/shared/asyncThumbnailAsset'

describe('asyncThumbnailAsset', () => {
  it('recognizes deferred 3D, DCC, and text formats', () => {
    expect(isDeferredThumbnailAsset('glb')).toBe(true)
    expect(isDeferredThumbnailAsset('c4d')).toBe(true)
    expect(isDeferredThumbnailAsset('json')).toBe(true)
    expect(isDeferredThumbnailAsset('md')).toBe(true)
    expect(isDeferredThumbnailAsset('usd')).toBe(false)
    expect(isDeferredThumbnailAsset('pdf')).toBe(false)
  })

  it('retries grid fetch only for deferred assets without thumb', () => {
    expect(shouldRetryThumbnailWhileEmpty('fbx', false)).toBe(true)
    expect(shouldRetryThumbnailWhileEmpty('blend', false)).toBe(true)
    expect(shouldRetryThumbnailWhileEmpty('txt', false)).toBe(true)
    expect(shouldRetryThumbnailWhileEmpty('fbx', true)).toBe(false)
    expect(shouldRetryThumbnailWhileEmpty('mp3', false)).toBe(false)
  })

  it('shows thumbnail slot for deferred assets even before hasThumbnail', () => {
    expect(shouldRenderThumbnailImage('md', false)).toBe(true)
    expect(shouldRenderThumbnailImage('psd', false)).toBe(false)
  })
})
