import { describe, expect, it } from 'vitest'
import {
  resolveFormatCapabilities,
  resolveAsyncThumbnailKind,
  isDeferredThumbnailExtension,
  shouldRenderThumbnailSlot,
  shouldRetryThumbnailWhileEmpty,
  supportsColorAnalysis,
  usesContainThumbnailFit,
  canUseAssetAsFolderCover,
  resolveCanvasFlowType,
  defaultLayoutAspectRatio
} from '@/shared/formatCapabilities'

describe('formatCapabilities', () => {
  it('resolves import pipelines from extension', () => {
    expect(resolveFormatCapabilities('jpg').importPipeline).toBe('image')
    expect(resolveFormatCapabilities('jpg').imagePipeline).toBe('raster')
    expect(resolveFormatCapabilities('svg').imagePipeline).toBe('svg')
    expect(resolveFormatCapabilities('exr').imagePipeline).toBe('exr')
    expect(resolveFormatCapabilities('mp4').importPipeline).toBe('video')
    expect(resolveFormatCapabilities('mp3').importPipeline).toBe('audio')
    expect(resolveFormatCapabilities('ttf').importPipeline).toBe('font')
    expect(resolveFormatCapabilities('psd').importPipeline).toBe('none')
  })

  it('derives defaultFileType for sidebar filter without driving behavior', () => {
    expect(resolveFormatCapabilities('glb').defaultFileType).toBe('3d')
    expect(resolveFormatCapabilities('json').defaultFileType).toBe('code')
    expect(resolveFormatCapabilities('md').defaultFileType).toBe('document')
  })

  it('resolves async thumbnail kinds from extension only', () => {
    expect(resolveAsyncThumbnailKind('glb')).toBe('model3d')
    expect(resolveAsyncThumbnailKind('c4d')).toBe('embedded-dcc')
    expect(resolveAsyncThumbnailKind('json')).toBe('text-preview')
    expect(resolveAsyncThumbnailKind('md')).toBe('text-preview')
    expect(resolveAsyncThumbnailKind('usd')).toBeNull()
    expect(resolveAsyncThumbnailKind('pdf')).toBeNull()
  })

  it('flags OBJ companion MTL copy', () => {
    expect(resolveFormatCapabilities('obj').copyObjCompanionMtl).toBe(true)
    expect(resolveFormatCapabilities('glb').copyObjCompanionMtl).toBe(false)
  })

  it('drives grid thumbnail slot visibility', () => {
    expect(isDeferredThumbnailExtension('fbx')).toBe(true)
    expect(shouldRetryThumbnailWhileEmpty('fbx', false)).toBe(true)
    expect(shouldRetryThumbnailWhileEmpty('fbx', true)).toBe(false)
    expect(shouldRenderThumbnailSlot('md', false)).toBe(true)
    expect(shouldRenderThumbnailSlot('psd', false)).toBe(false)
    expect(shouldRenderThumbnailSlot('jpg', false)).toBe(true)
  })

  it('exposes UI helper predicates', () => {
    expect(supportsColorAnalysis('jpg')).toBe(true)
    expect(supportsColorAnalysis('psd')).toBe(false)
    expect(usesContainThumbnailFit('ttf')).toBe(true)
    expect(usesContainThumbnailFit('png')).toBe(false)
    expect(canUseAssetAsFolderCover('jpg', false)).toBe(true)
    expect(canUseAssetAsFolderCover('psd', false)).toBe(false)
    expect(resolveCanvasFlowType('mp4')).toBe('base_video')
    expect(defaultLayoutAspectRatio('mp4')).toBeCloseTo(16 / 9)
  })
})
