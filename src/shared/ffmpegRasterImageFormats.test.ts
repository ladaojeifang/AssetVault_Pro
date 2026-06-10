import { describe, expect, it } from 'vitest'
import { IMAGE_EXTENSIONS } from './supportedFormats'
import {
  FFMPEG_STILL_RASTER_IMAGE_EXTENSIONS,
  isFfmpegStillRasterImageExtension,
  isFfmpegStillRasterImagePath
} from './ffmpegRasterImageFormats'

describe('ffmpegRasterImageFormats', () => {
  it('every ffmpeg-raster ext is in IMAGE_EXTENSIONS', () => {
    for (const ext of FFMPEG_STILL_RASTER_IMAGE_EXTENSIONS) {
      expect(IMAGE_EXTENSIONS.has(ext)).toBe(true)
    }
  })

  it('napi-native extras are whitelisted but not ffmpeg-raster', () => {
    for (const ext of ['.pbm', '.pgm', '.ppm', '.pam', '.dds', '.ff']) {
      expect(IMAGE_EXTENSIONS.has(ext)).toBe(true)
      expect(isFfmpegStillRasterImageExtension(ext)).toBe(false)
    }
  })

  it('detects paths by extension', () => {
    expect(isFfmpegStillRasterImagePath('C:/tex/albedo.tga')).toBe(true)
    expect(isFfmpegStillRasterImagePath('C:/tex/albedo.png')).toBe(false)
    expect(isFfmpegStillRasterImageExtension('HDR')).toBe(true)
  })

  it('jfif is a supported JPEG-family image, not ffmpeg-raster', () => {
    expect(IMAGE_EXTENSIONS.has('.jfif')).toBe(true)
    expect(isFfmpegStillRasterImageExtension('.jfif')).toBe(false)
  })
})
