import { describe, expect, it } from 'vitest'
import {
  articleBundleThumbRelative,
  mimeTypeForThumbPath,
  resolveExistingThumbnailRelPath
} from './thumbnailRead'
describe('thumbnailRead', () => {
  it('maps thumbnail extensions to MIME types', () => {
    expect(mimeTypeForThumbPath('items/id/_thumb.jpg')).toBe('image/jpeg')
    expect(mimeTypeForThumbPath('items/id/thumb.webp')).toBe('image/webp')
    expect(mimeTypeForThumbPath('items/id/thumb.png')).toBe('image/png')
  })

  it('builds article bundle thumb relative path', () => {
    expect(articleBundleThumbRelative('abc-123')).toBe('items/abc-123/_thumb.jpg')
  })

  it('resolveExistingThumbnailRelPath returns null without library root', () => {
    expect(resolveExistingThumbnailRelPath('missing-id')).toBeNull()
  })
})