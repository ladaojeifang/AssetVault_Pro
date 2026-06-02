import { readFileSync, statSync } from 'fs'
import { LRUCache } from 'lru-cache'
import type { ExrDecodeImage, ExrDecodeLayer } from 'exrs'
import type { ExrChannelToggle } from '@/shared/exrTypes'
import { EXR_DEFAULT_LAYER_NAME } from '@/shared/exrTypes'
import {
  detectExrAovDisplayMode,
  isVectorBackgroundZero,
  mapCryptoSample,
  mapDataSampleNormalized,
  mapVectorSample,
  refineExrAovDisplayMode,
  tonemapHdrSample,
  type ExrAovDisplayMode
} from '@/shared/exrAovDisplay'
import {
  groupExrChannelFullNames,
  isFlatMultiAovChannelLayout,
  parseExrChannelFullName,
  sortExrChannelSuffixes
} from '@/shared/exrLayerGrouping'
import { pickExrDefaultLayerNameFromLayers } from '@/shared/exrDefaultLayer'

export {
  estimateExrsChannelControlAvailable,
  estimateExrsChannelToggleAvailable,
  estimateExrsPerLayerPreviewAvailable,
  EXRS_PREVIEW_PIXEL_BUDGET
} from '@/shared/exrChannelBudget'

let initPromise: Promise<void> | null = null
const subLayerListCache = new WeakMap<ExrDecodeImage, ExrsSubLayer[]>()

const DECODE_CACHE_MAX = 8
const RGBA_CACHE_MAX = 32

type DecodeCacheEntry = { mtimeMs: number; image: ExrDecodeImage }
type RgbaCacheEntry = {
  mtimeMs: number
  rgba8: Buffer
  width: number
  height: number
  displayMode: ExrAovDisplayMode
}

const decodeCache = new LRUCache<string, DecodeCacheEntry>({ max: DECODE_CACHE_MAX })

const rgbaCache = new LRUCache<string, RgbaCacheEntry>({ max: RGBA_CACHE_MAX })

export function rgbaCacheKey(
  absPath: string,
  layerName: string,
  channels: ExrChannelToggle,
  exposure: number,
  maxEdge: number
): string {
  const c = channels
  return `${absPath}|${layerName}|${c.r ? 1 : 0}${c.g ? 1 : 0}${c.b ? 1 : 0}${c.a ? 1 : 0}|${exposure}|${maxEdge}`
}

export function exrsDecodeCacheSizeForTests(): number {
  return decodeCache.size
}

export function exrsRgbaCacheSizeForTests(): number {
  return rgbaCache.size
}

async function loadExrs(): Promise<typeof import('exrs')> {
  return import('exrs')
}

async function loadAndInitExrs(): Promise<void> {
  const exrs = await loadExrs()
  await exrs.init()
}

export async function ensureExrsInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = loadAndInitExrs().catch((err) => {
      initPromise = null
      throw err
    })
  }
  await initPromise
}

export function exrsLayerDisplayName(name: string | null): string {
  return name?.trim() ? name.trim() : EXR_DEFAULT_LAYER_NAME
}

export type ExrsSubLayer = {
  displayName: string
  channelSuffixes: string[]
  fullChannelNames: string[]
  layer: ExrDecodeLayer
  displayMode: ExrAovDisplayMode
}

export function listExrsSubLayers(image: ExrDecodeImage): ExrsSubLayer[] {
  const cached = subLayerListCache.get(image)
  if (cached) return cached

  const out: ExrsSubLayer[] = []

  for (const layer of image.layers) {
    const names = [...layer.channelNamesAlphabetical]
    if (isFlatMultiAovChannelLayout(names)) {
      for (const g of groupExrChannelFullNames(names)) {
        out.push({
          displayName: g.displayName,
          channelSuffixes: g.channelSuffixes,
          fullChannelNames: g.fullChannelNames,
          layer,
          displayMode: detectExrAovDisplayMode(g.displayName, g.channelSuffixes)
        })
      }
    } else {
      const channelSuffixes = sortExrChannelSuffixes(
        names.map((n) => parseExrChannelFullName(n).suffix)
      )
      const suffixToFull = new Map<string, string>()
      for (const fullName of names) {
        const { suffix } = parseExrChannelFullName(fullName)
        suffixToFull.set(suffix.toUpperCase(), fullName)
      }
      const fullChannelNames = channelSuffixes.map(
        (s) => suffixToFull.get(s.toUpperCase()) ?? s
      )
      const displayName = exrsLayerDisplayName(layer.name)
      out.push({
        displayName,
        channelSuffixes,
        fullChannelNames,
        layer,
        displayMode: detectExrAovDisplayMode(displayName, channelSuffixes)
      })
    }
  }

  out.sort((a, b) => {
    if (a.displayName === EXR_DEFAULT_LAYER_NAME) return -1
    if (b.displayName === EXR_DEFAULT_LAYER_NAME) return 1
    return a.displayName.localeCompare(b.displayName)
  })

  subLayerListCache.set(image, out)
  return out
}

export function findExrsSubLayer(image: ExrDecodeImage, displayName: string): ExrsSubLayer | null {
  return listExrsSubLayers(image).find((s) => s.displayName === displayName) ?? null
}

/** Pick default layer for thumbnails / initial preview (uses exrs decode result). */
export function pickExrThumbnailLayerName(image: ExrDecodeImage): string {
  const subs = listExrsSubLayers(image)
  return pickExrDefaultLayerNameFromLayers(
    subs.map((s) => ({
      name: s.displayName,
      channels: s.channelSuffixes,
      previewable: true,
      displayMode: s.displayMode
    }))
  )
}

export function channelSuffixForToggle(
  channelSuffixes: readonly string[],
  key: keyof ExrChannelToggle
): string | null {
  const upper = channelSuffixes.map((c) => c.toUpperCase())
  if (key === 'r') return upper.find((s) => s === 'R' || s === 'X') ?? null
  if (key === 'g') return upper.find((s) => s === 'G' || s === 'Y') ?? null
  if (key === 'b') return upper.find((s) => s === 'B' || s === 'Z') ?? null
  if (key === 'a') return upper.find((s) => s === 'A') ?? null
  return null
}

function mapSampleToDisplay8(
  mode: ExrAovDisplayMode,
  value: number,
  exposure: number,
  dataNorm: { min: number; max: number } | null
): number {
  switch (mode) {
    case 'vector':
      return mapVectorSample(value)
    case 'crypto':
      return mapCryptoSample(value)
    case 'data': {
      if (!dataNorm || dataNorm.max <= dataNorm.min) return 0
      const t = (value - dataNorm.min) / (dataNorm.max - dataNorm.min)
      return mapDataSampleNormalized(t)
    }
    default:
      return tonemapHdrSample(value, exposure)
  }
}

function computeDataRange(
  samples: Float32Array,
  pixelCount: number,
  channelCount: number,
  channelIndices: number[]
): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < pixelCount; i++) {
    for (const ci of channelIndices) {
      const v = samples[i * channelCount + ci] ?? 0
      if (!Number.isFinite(v)) continue
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 }
  return { min, max }
}

function collectEnabledChannelIndices(
  channelSuffixes: readonly string[],
  suffixToIdx: Map<string, number>,
  channels: ExrChannelToggle,
  displayMode: ExrAovDisplayMode
): number[] {
  const indices: number[] = []
  const add = (suffix: string | null) => {
    if (!suffix) return
    const ci = suffixToIdx.get(suffix.toUpperCase())
    if (ci !== undefined && !indices.includes(ci)) indices.push(ci)
  }

  if (displayMode === 'data') {
    if (channels.r) add(channelSuffixForToggle(channelSuffixes, 'r'))
    if (channels.g) add(channelSuffixForToggle(channelSuffixes, 'g'))
    if (channels.b) add(channelSuffixForToggle(channelSuffixes, 'b'))
    if (channels.a) add(channelSuffixForToggle(channelSuffixes, 'a'))
    if (indices.length === 0) {
      add(
        channelSuffixForToggle(channelSuffixes, 'r') ??
          channelSuffixForToggle(channelSuffixes, 'g') ??
          channelSuffixForToggle(channelSuffixes, 'b') ??
          channelSuffixForToggle(channelSuffixes, 'a')
      )
      if (indices.length === 0) indices.push(0)
    }
    return indices
  }

  add(channelSuffixForToggle(channelSuffixes, 'r'))
  add(channelSuffixForToggle(channelSuffixes, 'g'))
  add(channelSuffixForToggle(channelSuffixes, 'b'))
  return indices.length > 0 ? indices : [0]
}

function downsampleInterleaved(
  src: Float32Array,
  channelCount: number,
  width: number,
  height: number,
  maxEdge: number
): { data: Float32Array; width: number; height: number } {
  let w = width
  let h = height
  let data = src

  while (Math.max(w, h) > maxEdge) {
    const nw = Math.max(1, Math.ceil(w / 2))
    const nh = Math.max(1, Math.ceil(h / 2))
    const out = new Float32Array(nw * nh * channelCount)

    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const sx = Math.min(w - 1, x * 2)
        const sy = Math.min(h - 1, y * 2)
        const dst = (y * nw + x) * channelCount

        for (let c = 0; c < channelCount; c++) {
          let sum = 0
          let n = 0
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const px = Math.min(w - 1, sx + dx)
              const py = Math.min(h - 1, sy + dy)
              sum += data[(py * w + px) * channelCount + c]
              n++
            }
          }
          out[dst + c] = sum / n
        }
      }
    }

    data = out
    w = nw
    h = nh
  }

  return { data, width: w, height: h }
}

export function buildRgba8FromExrsSubLayer(
  sub: ExrsSubLayer,
  channels: ExrChannelToggle,
  exposure: number,
  width: number,
  height: number,
  maxEdge: number
): { rgba8: Buffer; width: number; height: number; displayMode: ExrAovDisplayMode } {
  const pixels = sub.layer.getInterleavedPixels(sub.fullChannelNames)
  if (!pixels?.length) {
    throw new Error(`EXR layer "${sub.displayName}" has no pixel data`)
  }

  const channelCount = sub.fullChannelNames.length
  let w = width
  let h = height
  let samples = pixels

  if (w * h > maxEdge * maxEdge) {
    const scaled = downsampleInterleaved(samples, channelCount, w, h, maxEdge)
    samples = scaled.data
    w = scaled.width
    h = scaled.height
  }

  const pixelCount = w * h
  const rgba8 = Buffer.alloc(pixelCount * 4)
  const suffixToIdx = new Map<string, number>()
  for (let i = 0; i < sub.channelSuffixes.length; i++) {
    suffixToIdx.set(sub.channelSuffixes[i]!.toUpperCase(), i)
  }

  const readChannel = (pixelIndex: number, suffix: string | null): number => {
    if (!suffix) return 0
    const ci = suffixToIdx.get(suffix.toUpperCase())
    if (ci === undefined) return 0
    return samples[pixelIndex * channelCount + ci] ?? 0
  }

  const rSuffix = channelSuffixForToggle(sub.channelSuffixes, 'r')
  const gSuffix = channelSuffixForToggle(sub.channelSuffixes, 'g')
  const bSuffix = channelSuffixForToggle(sub.channelSuffixes, 'b')
  const aSuffix = channelSuffixForToggle(sub.channelSuffixes, 'a')

  const rangeIndices = collectEnabledChannelIndices(
    sub.channelSuffixes,
    suffixToIdx,
    channels,
    sub.displayMode
  )
  const sampleRange = computeDataRange(samples, pixelCount, channelCount, rangeIndices)
  let displayMode = refineExrAovDisplayMode(sub.displayMode, sampleRange.min, sampleRange.max)

  const dataIndices =
    displayMode === 'data'
      ? collectEnabledChannelIndices(sub.channelSuffixes, suffixToIdx, channels, 'data')
      : []
  const dataNorm =
    displayMode === 'data'
      ? computeDataRange(samples, pixelCount, channelCount, dataIndices)
      : null

  const anyRgb = channels.r || channels.g || channels.b
  const useAlphaAsLuma = !anyRgb && channels.a

  for (let i = 0; i < pixelCount; i++) {
    const dst = i * 4
    let outR = 0
    let outG = 0
    let outB = 0
    let outA = 255

    const rawR = readChannel(i, rSuffix)
    const rawG = readChannel(i, gSuffix)
    const rawB = readChannel(i, bSuffix)
    const rawA = readChannel(i, aSuffix)

    if (displayMode === 'vector' && anyRgb) {
      if (isVectorBackgroundZero(rawR, rawG, rawB)) {
        outR = outG = outB = 0
      } else {
        if (channels.r) outR = mapSampleToDisplay8('vector', rawR, exposure, null)
        if (channels.g) outG = mapSampleToDisplay8('vector', rawG, exposure, null)
        if (channels.b) outB = mapSampleToDisplay8('vector', rawB, exposure, null)
      }
    } else if (useAlphaAsLuma && aSuffix) {
      const v = mapSampleToDisplay8(displayMode, rawA, exposure, dataNorm)
      outR = outG = outB = v
      outA = 255
    } else {
      if (channels.r) outR = mapSampleToDisplay8(displayMode, rawR, exposure, dataNorm)
      if (channels.g) outG = mapSampleToDisplay8(displayMode, rawG, exposure, dataNorm)
      if (channels.b) outB = mapSampleToDisplay8(displayMode, rawB, exposure, dataNorm)
      if (channels.a && aSuffix) {
        outA = mapSampleToDisplay8(displayMode, rawA, exposure, dataNorm)
      }
    }

    rgba8[dst] = outR
    rgba8[dst + 1] = outG
    rgba8[dst + 2] = outB
    rgba8[dst + 3] = outA
  }

  return { rgba8, width: w, height: h, displayMode }
}

export function buildRgba8FromExrsSubLayerCached(
  absPath: string,
  sub: ExrsSubLayer,
  channels: ExrChannelToggle,
  exposure: number,
  width: number,
  height: number,
  maxEdge: number
): { rgba8: Buffer; width: number; height: number; displayMode: ExrAovDisplayMode } {
  const { mtimeMs } = statSync(absPath)
  const key = rgbaCacheKey(absPath, sub.displayName, channels, exposure, maxEdge)
  const hit = rgbaCache.get(key)
  if (hit && hit.mtimeMs === mtimeMs) {
    return {
      rgba8: hit.rgba8,
      width: hit.width,
      height: hit.height,
      displayMode: hit.displayMode
    }
  }

  const built = buildRgba8FromExrsSubLayer(sub, channels, exposure, width, height, maxEdge)
  rgbaCache.set(key, { mtimeMs, ...built })
  return built
}

export async function decodeExrFile(absPath: string): Promise<ExrDecodeImage> {
  await ensureExrsInitialized()
  const exrs = await loadExrs()
  const bytes = readFileSync(absPath)
  return exrs.decodeExr(new Uint8Array(bytes))
}

export async function decodeExrFileCached(absPath: string): Promise<ExrDecodeImage> {
  const { mtimeMs } = statSync(absPath)
  const hit = decodeCache.get(absPath)
  if (hit && hit.mtimeMs === mtimeMs) return hit.image

  const image = await decodeExrFile(absPath)
  decodeCache.set(absPath, { mtimeMs, image })
  return image
}
