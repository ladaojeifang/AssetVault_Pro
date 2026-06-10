import { describe, expect, it } from 'vitest'
import {
  listAssetPreviewKinds,
  resolveAssetOpenAction,
  resolveAssetPreviewKind
} from './assetPreviewRegistry'

describe('assetPreviewRegistry', () => {
  it('routes font assets to font preview', () => {
    expect(resolveAssetPreviewKind({ fileType: 'font', extension: 'ttf' })).toBe('font')
    expect(resolveAssetOpenAction({ fileType: 'font', extension: 'otf' })).toBe('font')
  })

  it('routes glb to model preview', () => {
    expect(resolveAssetPreviewKind({ fileType: '3d', extension: 'glb' })).toBe('model')
  })

  it('routes svg and exr images separately', () => {
    expect(resolveAssetPreviewKind({ fileType: 'image', extension: 'svg' })).toBe('svg')
    expect(resolveAssetPreviewKind({ fileType: 'image', extension: 'exr' })).toBe('exr')
  })

  it('routes markdown by extension', () => {
    expect(resolveAssetPreviewKind({ fileType: 'document', extension: 'md' })).toBe('markdown')
    expect(listAssetPreviewKinds({ fileType: 'document', extension: 'md' })).toEqual(['markdown'])
  })

  it('falls back to explorer for generic files', () => {
    expect(resolveAssetOpenAction({ fileType: 'image', extension: 'jpg' })).toBe('explorer')
    expect(resolveAssetPreviewKind({ fileType: '3d', extension: 'blend' })).toBeNull()
  })
})
