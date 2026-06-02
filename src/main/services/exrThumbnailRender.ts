import { Transformer } from '@napi-rs/image'
import { EXR_PREVIEW_DEFAULT_EXPOSURE } from '@/shared/exrTypes'
import { rasterizeExrToWebpBuffer } from '../utils/exrRaster'
import {
  buildRgba8FromExrsSubLayer,
  decodeExrFileCached,
  ensureExrsInitialized,
  findExrsSubLayer,
  pickExrThumbnailLayerName
} from './exrExrsDecoder'

/**
 * EXR grid thumbnail: exrs default-layer preview (HDR tonemap) with napi/ffmpeg fallback.
 */
export async function renderExrThumbnailWebp(
  absPath: string,
  maxEdge: number,
  quality: number
): Promise<Buffer | null> {
  try {
    await ensureExrsInitialized()
    const image = await decodeExrFileCached(absPath)
    const layerName = pickExrThumbnailLayerName(image)
    const sub = findExrsSubLayer(image, layerName)
    if (!sub) {
      throw new Error(`thumbnail layer "${layerName}" not found after pick`)
    }

    const { rgba8, width, height } = buildRgba8FromExrsSubLayer(
      sub,
      { r: true, g: true, b: true, a: false },
      EXR_PREVIEW_DEFAULT_EXPOSURE,
      image.width,
      image.height,
      maxEdge
    )

    const jpeg = (await Transformer.fromRgbaPixels(rgba8, width, height).jpeg(
      Math.min(95, quality + 5)
    )) as Buffer
    if (!jpeg?.length) throw new Error('JPEG encode returned empty buffer')

    return (await new Transformer(jpeg).webp(quality)) as Buffer
  } catch (e) {
    console.warn('[ExrThumbnail] exrs path failed, using napi/ffmpeg:', absPath, e)
  }

  return rasterizeExrToWebpBuffer(absPath, maxEdge, quality)
}
