import { describe, expect, it } from 'vitest'
import type { FileType } from '@/shared/types'
import {
  AUDIO_FORMATS,
  CODE_FORMATS,
  DESIGN_FORMATS,
  DOCUMENT_FORMATS,
  FONT_FORMATS,
  IMAGE_FORMAT_GROUPS,
  MODEL3D_IMPORT_ONLY_FORMATS,
  MODEL3D_PREVIEW_FORMATS,
  VIDEO_FORMATS
} from '@/shared/assetFormatCatalog'
import {
  getFileTypeFromExtension,
  getFileTypeFromMime,
  getMimeForExtension,
  isSupportedImportExtension
} from '@/shared/assetFormatRegistry'

type GroupCase = { ext: string; expected: FileType }

function cases(exts: readonly string[], expected: FileType): GroupCase[] {
  return exts.map((ext) => ({ ext, expected }))
}

const MATRIX: GroupCase[] = [
  ...cases(Object.values(IMAGE_FORMAT_GROUPS).flat(), 'image'),
  ...cases(VIDEO_FORMATS, 'video'),
  ...cases(AUDIO_FORMATS, 'audio'),
  ...cases(FONT_FORMATS, 'font'),
  ...cases(DESIGN_FORMATS, 'design'),
  ...cases(DOCUMENT_FORMATS, 'document'),
  ...cases([...MODEL3D_PREVIEW_FORMATS, ...MODEL3D_IMPORT_ONLY_FORMATS], '3d'),
  ...cases(CODE_FORMATS, 'code')
]

describe('assetFormatRegistry matrix', () => {
  it.each(MATRIX)('.$ext → $expected', ({ ext, expected }) => {
    expect(getFileTypeFromExtension(ext)).toBe(expected)
    expect(getFileTypeFromExtension(`.${ext}`)).toBe(expected)
    expect(isSupportedImportExtension(ext)).toBe(true)
  })

  it('unknown extension is not supported and has no file type', () => {
    expect(getFileTypeFromExtension('.xyz')).toBeNull()
    expect(isSupportedImportExtension('.xyz')).toBe(false)
  })

  it('catalog MIME maps back to file type for raster images', () => {
    for (const ext of IMAGE_FORMAT_GROUPS.raster) {
      const mime = getMimeForExtension(ext)
      expect(mime, ext).toBeTruthy()
      expect(getFileTypeFromMime(mime!)).toBe('image')
    }
  })

  it('extension wins over generic MIME in getFileType', async () => {
    const { getFileType } = await import('@/main/utils/fileUtils')
    expect(getFileType('application/octet-stream', '.fbx')).toBe('3d')
    expect(getFileType('application/octet-stream', '.pdf')).toBe('design')
  })

  it('catalog MIME maps fbx octet-stream to 3d', () => {
    expect(getFileTypeFromMime('application/octet-stream')).toBe('3d')
  })
})
