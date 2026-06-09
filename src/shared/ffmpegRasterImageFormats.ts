import { extname } from 'path'

/**
 * Raster formats decoded via ffmpeg → PNG before @napi-rs/image.
 * (No napi decoder and/or no reliable magic bytes — e.g. TGA.)
 */
export const FFMPEG_STILL_RASTER_IMAGE_EXTENSIONS = new Set([
  '.tga', '.hdr', '.qoi', '.apng', '.jp2', '.j2k', '.jpc', '.j2c', '.jls',
  '.dpx', '.pcx', '.rgb', '.rgba', '.bw', '.sun', '.ras', '.xbm', '.xpm',
  '.fits', '.fit', '.fts'
])

export function normalizeImageExtension(ext: string): string {
  const e = ext.toLowerCase().trim()
  return e.startsWith('.') ? e : `.${e}`
}

export function isFfmpegStillRasterImageExtension(ext: string): boolean {
  return FFMPEG_STILL_RASTER_IMAGE_EXTENSIONS.has(normalizeImageExtension(ext))
}

export function isFfmpegStillRasterImagePath(filePath: string): boolean {
  return isFfmpegStillRasterImageExtension(extname(filePath))
}
