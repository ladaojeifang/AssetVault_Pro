import { readFileSync } from 'fs'
import { Transformer, ResizeFit } from '@napi-rs/image'
import { extractExrFramePngBestEffort } from './videoFrame'

/**
 * EXR is often Rgba32F (HDR). @napi-rs/image can decode it but cannot encode
 * float pixels directly to WebP/PNG. Resize → JPEG produces 8-bit sRGB bytes.
 * Large EXR files may exceed the decoder memory cap; ffmpeg scales while decoding.
 */
export async function rasterizeExrPreviewJpeg(
  filePath: string,
  maxEdge: number,
  quality = 85
): Promise<Buffer | null> {
  try {
    const fileBuffer = readFileSync(filePath)
    const transformer = new Transformer(fileBuffer)
    return (await transformer
      .resize(maxEdge, maxEdge, undefined, ResizeFit.Inside)
      .jpeg(quality)) as Buffer
  } catch {
    /* fall through to ffmpeg */
  }

  const png = await extractExrFramePngBestEffort(filePath, maxEdge)
  if (!png?.length) return null

  try {
    return (await new Transformer(png).jpeg(quality)) as Buffer
  } catch {
    return null
  }
}

export async function rasterizeExrToWebpBuffer(
  filePath: string,
  maxEdge: number,
  quality: number
): Promise<Buffer | null> {
  const jpeg = await rasterizeExrPreviewJpeg(filePath, maxEdge, Math.min(95, quality + 5))
  if (!jpeg?.length) return null
  try {
    return (await new Transformer(jpeg).webp(quality)) as Buffer
  } catch {
    return null
  }
}
