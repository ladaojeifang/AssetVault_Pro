import { readFileSync, statSync } from 'fs'
import { Transformer, ResizeFit } from '@napi-rs/image'
import type { ExrAovDisplayMode } from '@/shared/exrAovDisplay'
import { tonemapHdrSample } from '@/shared/exrAovDisplay'
import type { ExrChannelToggle, ExrPreviewRenderRequest } from '@/shared/exrTypes'
import { EXR_DEFAULT_LAYER_NAME, EXR_PREVIEW_MAX_EDGE } from '@/shared/exrTypes'
import { estimateExrsChannelToggleAvailable } from '@/shared/exrChannelBudget'
import { estimateNapiChannelControlAvailable } from '../utils/exrMetadata'
import { rasterizeExrPreviewJpeg } from '../utils/exrRaster'
import {
  buildRgba8FromExrsSubLayerCached,
  decodeExrFileCached,
  ensureExrsInitialized,
  findExrsSubLayer
} from './exrExrsDecoder'

const JPEG_QUALITY = 88

export type ExrPreviewFailureReason = 'layer_missing' | 'decode_failed' | 'render_failed'

/**
 * exrs failure fallback (see doc/exr-preview-fix-plan.md):
 *   ok              → return exrs JPEG
 *   layer_missing   → RGBA: napi/ffmpeg; else fail
 *   decode_failed   → RGBA: napi/ffmpeg; else fail
 *   render_failed   → RGBA: napi/ffmpeg; else fail
 */

function clampExposure(exposure: number): number {
  return Math.min(8, Math.max(0.1, exposure))
}

function buildRgba8FromFloat32(
  raw: Buffer,
  pixelCount: number,
  channels: ExrChannelToggle,
  exposure: number
): Buffer {
  const out = Buffer.alloc(pixelCount * 4)

  for (let i = 0; i < pixelCount; i++) {
    const src = i * 16
    const dst = i * 4
    const r = raw.readFloatLE(src)
    const g = raw.readFloatLE(src + 4)
    const b = raw.readFloatLE(src + 8)
    const a = raw.readFloatLE(src + 12)

    const outR = channels.r ? tonemapHdrSample(r, exposure) : 0
    const outG = channels.g ? tonemapHdrSample(g, exposure) : 0
    const outB = channels.b ? tonemapHdrSample(b, exposure) : 0

    let outA = 255
    if (channels.a) {
      outA = tonemapHdrSample(a, exposure)
    }

    out[dst] = outR
    out[dst + 1] = outG
    out[dst + 2] = outB
    out[dst + 3] = outA
  }

  return out
}

async function renderViaNapi(
  absPath: string,
  channels: ExrChannelToggle,
  exposure: number,
  maxEdge: number
): Promise<Buffer | null> {
  const fileBuffer = readFileSync(absPath)
  const transformer = new Transformer(fileBuffer)
  const meta = await transformer.metadata()
  const raw = (await transformer.rawPixels()) as Buffer
  const pixelCount = meta.width * meta.height

  const rgba8 = buildRgba8FromFloat32(raw, pixelCount, channels, exposure)
  const out = Transformer.fromRgbaPixels(rgba8, meta.width, meta.height)
  return (await out.resize(maxEdge, maxEdge, undefined, ResizeFit.Inside).jpeg(JPEG_QUALITY)) as Buffer
}

type ExrsRenderResult =
  | { ok: true; jpeg: Buffer; displayMode: ExrAovDisplayMode; channelControlAvailable: boolean }
  | { ok: false; error: string; reason: ExrPreviewFailureReason }

async function renderViaExrs(
  absPath: string,
  layerName: string,
  channels: ExrChannelToggle,
  exposure: number,
  maxEdge: number
): Promise<ExrsRenderResult> {
  await ensureExrsInitialized()
  const image = await decodeExrFileCached(absPath)
  const sub = findExrsSubLayer(image, layerName)
  if (!sub) {
    return {
      ok: false,
      reason: 'layer_missing',
      error: `图层「${layerName}」在 EXR 解码结果中不存在`
    }
  }

  const fileSize = statSync(absPath).size
  const channelControlAvailable = estimateExrsChannelToggleAvailable(
    image.width,
    image.height,
    fileSize
  )

  let rgba8: Buffer
  let width: number
  let height: number
  let displayMode: ExrAovDisplayMode

  try {
    const built = buildRgba8FromExrsSubLayerCached(
      absPath,
      sub,
      channels,
      exposure,
      image.width,
      image.height,
      maxEdge
    )
    rgba8 = built.rgba8
    width = built.width
    height = built.height
    displayMode = built.displayMode
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      reason: 'decode_failed',
      error: `图层「${layerName}」像素解码失败：${msg}`
    }
  }

  try {
    const out = Transformer.fromRgbaPixels(rgba8, width, height)
    const jpeg = (await out
      .resize(maxEdge, maxEdge, undefined, ResizeFit.Inside)
      .jpeg(JPEG_QUALITY)) as Buffer
    if (!jpeg?.length) {
      return { ok: false, reason: 'render_failed', error: 'JPEG 编码失败' }
    }
    return { ok: true, jpeg, displayMode, channelControlAvailable }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, reason: 'render_failed', error: `预览编码失败：${msg}` }
  }
}

export async function renderExrPreviewJpeg(
  absPath: string,
  req: Pick<ExrPreviewRenderRequest, 'layerName' | 'channels' | 'exposure' | 'maxEdge'>
): Promise<{
  jpeg: Buffer | null
  channelControlAvailable: boolean
  displayMode?: ExrAovDisplayMode
  error?: string
  failureReason?: ExrPreviewFailureReason
}> {
  const maxEdge = Math.min(
    EXR_PREVIEW_MAX_EDGE,
    Math.max(256, Math.floor(req.maxEdge ?? EXR_PREVIEW_MAX_EDGE))
  )
  const exposure = clampExposure(req.exposure)
  const channels = req.channels
  const layerName = req.layerName || EXR_DEFAULT_LAYER_NAME

  const anyChannel = channels.r || channels.g || channels.b || channels.a
  const effectiveChannels: ExrChannelToggle = anyChannel
    ? channels
    : { r: true, g: true, b: true, a: false }

  let result: ExrsRenderResult
  try {
    result = await renderViaExrs(absPath, layerName, effectiveChannels, exposure, maxEdge)
  } catch (e) {
    console.warn('[ExrPreview] exrs render failed, trying napi/ffmpeg:', absPath, e)
    const msg = e instanceof Error ? e.message : String(e)
    result = {
      ok: false,
      reason: 'decode_failed',
      error: `EXR 解码失败：${msg}`
    }
  }

  if (result.ok && result.jpeg?.length) {
    return {
      jpeg: result.jpeg,
      channelControlAvailable: result.channelControlAvailable,
      displayMode: result.displayMode
    }
  }

  if (!result.ok && layerName !== EXR_DEFAULT_LAYER_NAME) {
    return {
      jpeg: null,
      channelControlAvailable: false,
      error: result.error,
      failureReason: result.reason
    }
  }

  const napiAvailable = estimateNapiChannelControlAvailable(absPath)
  const useNapiPipeline = layerName === EXR_DEFAULT_LAYER_NAME && napiAvailable

  if (useNapiPipeline) {
    try {
      const jpeg = await renderViaNapi(absPath, effectiveChannels, exposure, maxEdge)
      if (jpeg?.length) {
        return { jpeg, channelControlAvailable: napiAvailable, displayMode: 'hdr' }
      }
    } catch (e) {
      console.warn('[ExrPreview] napi render failed, trying ffmpeg:', absPath, e)
    }
  }

  try {
    const jpeg = await rasterizeExrPreviewJpeg(absPath, maxEdge, JPEG_QUALITY)
    if (jpeg?.length) {
      return {
        jpeg,
        channelControlAvailable: false,
        displayMode: 'hdr'
      }
    }
  } catch (e) {
    console.warn('[ExrPreview] ffmpeg render failed:', absPath, e)
  }

  return {
    jpeg: null,
    channelControlAvailable: false,
    error: 'EXR 预览渲染失败',
    failureReason: 'render_failed'
  }
}
