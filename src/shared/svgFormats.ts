/** SVG asset helpers (extension checks shared by main + renderer). */

/** Max SVG file size for hidden-window rasterization (thumb + palette). */
export const MAX_SVG_RASTER_BYTES = 5 * 1024 * 1024

export function normalizeExtension(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase().trim()
}

export function isSvgExtension(ext: string): boolean {
  return normalizeExtension(ext) === 'svg'
}

export function isSvgFilePath(filePath: string): boolean {
  const i = filePath.lastIndexOf('.')
  if (i < 0) return false
  return isSvgExtension(filePath.slice(i))
}

export function isSvgOverRasterLimit(fileSizeBytes: number | null | undefined): boolean {
  return typeof fileSizeBytes === 'number' && fileSizeBytes > MAX_SVG_RASTER_BYTES
}
