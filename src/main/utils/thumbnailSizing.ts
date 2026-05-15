/** Max edge for generated WebP thumbnails; images smaller than this use the original file. */
export const THUMBNAIL_MAX_EDGE = 256

export function shouldUseOriginalImageDimensions(
  width?: number | null,
  height?: number | null
): boolean {
  if (width == null || height == null || width <= 0 || height <= 0) return false
  return Math.max(width, height) < THUMBNAIL_MAX_EDGE
}

export function bufferToImageDataUrl(buffer: Buffer, mimeType: string): string {
  const mime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg'
  return `data:${mime};base64,${buffer.toString('base64')}`
}
