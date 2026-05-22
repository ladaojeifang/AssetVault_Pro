import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { Transformer, ResizeFit } from '@napi-rs/image'
import { itemDirAbsolute } from './libraryBundle'
import { getThumbnailService } from './ThumbnailService'
import { THUMBNAIL_MAX_EDGE } from '../utils/thumbnailSizing'

export const THUMB_CUSTOM_MARKER = '.thumb-custom'

export function isCustomThumbnail(assetId: string): boolean {
  return existsSync(join(itemDirAbsolute(assetId), THUMB_CUSTOM_MARKER))
}

export function markCustomThumbnail(assetId: string): void {
  const dir = itemDirAbsolute(assetId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, THUMB_CUSTOM_MARKER), 'custom', 'utf-8')
}

export function clearCustomThumbnail(assetId: string): void {
  const p = join(itemDirAbsolute(assetId), THUMB_CUSTOM_MARKER)
  if (existsSync(p)) unlinkSync(p)
}

/** Resize arbitrary image bytes → thumb.webp and mark as user override. */
export async function writeCustomThumbnailFromImageBytes(
  assetId: string,
  imageBytes: Buffer,
  quality = 85
): Promise<Buffer> {
  const thumbService = getThumbnailService()
  thumbService.forgetMemoryCache(assetId)

  const transformer = new Transformer(imageBytes)
  const webpBuffer = (await transformer
    .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, undefined, ResizeFit.Inside)
    .webp(quality)) as Buffer

  const dir = itemDirAbsolute(assetId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const outPath = join(dir, 'thumb.webp')
  writeFileSync(outPath, webpBuffer)

  markCustomThumbnail(assetId)

  return webpBuffer
}
