import { describe, expect, it } from 'vitest'
import {
  ALL_SUPPORTED_IMPORT_EXTENSIONS,
  FFMPEG_STILL_RASTER_IMAGE_EXTENSIONS,
  IMAGE_EXTENSIONS,
  getFileTypeFromExtension,
  getFileTypeFromMime,
  getMimeForExtension,
  isFolderIconExtension,
  isMarkdownExtension,
  isSvgExtension,
  isSupportedImportExtension
} from '@/shared/assetFormatRegistry'
import { IMAGE_FORMAT_GROUPS } from '@/shared/assetFormatCatalog'

describe('assetFormatRegistry', () => {
  it('builds IMAGE_EXTENSIONS from all image groups', () => {
    for (const group of Object.values(IMAGE_FORMAT_GROUPS)) {
      for (const ext of group) {
        expect(IMAGE_EXTENSIONS.has(`.${ext}`)).toBe(true)
      }
    }
  })

  it('classifies jfif as image with jpeg mime', () => {
    expect(getFileTypeFromExtension('.jfif')).toBe('image')
    expect(getMimeForExtension('jfif')).toBe('image/jpeg')
    expect(getFileTypeFromMime('image/jpeg')).toBe('image')
    expect(isSupportedImportExtension('.jfif')).toBe(true)
  })

  it('svg and exr use image subgroups', () => {
    expect(isSvgExtension('.svg')).toBe(true)
    expect(getFileTypeFromExtension('.exr')).toBe('image')
  })

  it('markdown preview extensions', () => {
    expect(isMarkdownExtension('md')).toBe(true)
    expect(isMarkdownExtension('.markdown')).toBe(true)
  })

  it('folder icon whitelist from catalog', () => {
    expect(isFolderIconExtension('.jfif')).toBe(true)
    expect(isFolderIconExtension('.pdf')).toBe(false)
  })

  it('ffmpeg raster subset is in IMAGE_EXTENSIONS', () => {
    for (const ext of FFMPEG_STILL_RASTER_IMAGE_EXTENSIONS) {
      expect(IMAGE_EXTENSIONS.has(ext)).toBe(true)
      expect(ALL_SUPPORTED_IMPORT_EXTENSIONS.has(ext)).toBe(true)
    }
  })
})
