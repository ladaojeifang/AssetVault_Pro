import { closeSync, openSync, readFileSync, readSync, statSync } from 'fs'
import { Transformer } from '@napi-rs/image'
import type { ExrFileMetadata, ExrLayerInfo, ExrStoredMetadata } from '@/shared/exrTypes'
import { EXR_DEFAULT_LAYER_NAME } from '@/shared/exrTypes'
import { detectExrAovDisplayMode } from '@/shared/exrAovDisplay'
import { pickExrDefaultLayerNameFromLayers } from '@/shared/exrDefaultLayer'
import { groupExrHeaderChannelNames } from '@/shared/exrLayerGrouping'
import {
  estimateExrsChannelToggleAvailable,
  estimateExrsPerLayerPreviewAvailable
} from '@/shared/exrChannelBudget'

/** OpenEXR magic on disk: bytes `76 2f 31 01` → uint32 LE (20000630). */
export const EXR_MAGIC = 0x01312f76

export const EXR_FLAG_LONG_NAMES = 0x400
export const EXR_FLAG_NON_IMAGE = 0x200
export const EXR_FLAG_MULTIPART = 0x1000

/** Read only the header region — enough for chlist on production EXR. */
const MAX_HEADER_READ_BYTES = 32 * 1024 * 1024

/** Rough decode budget — above this prefer ffmpeg (no per-channel control). */
const NAPI_DECODE_BYTE_BUDGET = 48 * 1024 * 1024

export type ExrDimensions = { width: number; height: number }

export type ExrHeaderChannel = {
  name: string
  pixelType: number
}

type ExrAttribute = { name: string; type: string; value: Buffer }

export function readExrHeaderBuffer(absPath: string, maxBytes = MAX_HEADER_READ_BYTES): Buffer {
  const fd = openSync(absPath, 'r')
  try {
    const fileSize = statSync(absPath).size
    const len = Math.min(fileSize, maxBytes)
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, 0)
    return buf
  } finally {
    closeSync(fd)
  }
}

function readLengthPrefixedAscii(buffer: Buffer, off: number): { text: string; next: number } | null {
  if (off + 4 > buffer.length) return null
  const len = buffer.readInt32LE(off)
  off += 4
  if (len <= 0) return { text: '', next: off }
  if (off + len > buffer.length) return null
  return { text: buffer.toString('ascii', off, off + len), next: off + len }
}

export function readExrVersionFlags(buffer: Buffer): {
  multipart: boolean
  nonImage: boolean
  longNames: boolean
} {
  if (buffer.length < 8 || buffer.readUInt32LE(0) !== EXR_MAGIC) {
    return { multipart: false, nonImage: false, longNames: false }
  }
  const version = buffer.readUInt32LE(4)
  return {
    longNames: (version & EXR_FLAG_LONG_NAMES) !== 0,
    nonImage: (version & EXR_FLAG_NON_IMAGE) !== 0,
    multipart: (version & EXR_FLAG_MULTIPART) !== 0
  }
}

export function walkExrAttributes(buffer: Buffer, maxBytes = buffer.length): ExrAttribute[] {
  if (buffer.length < 16 || buffer.readUInt32LE(0) !== EXR_MAGIC) return []

  const { longNames } = readExrVersionFlags(buffer)

  const attrs: ExrAttribute[] = []
  let off = 8
  const limit = Math.min(buffer.length, maxBytes)

  while (off < limit - 4) {
    let name = ''
    let type = ''

    if (longNames) {
      const namePart = readLengthPrefixedAscii(buffer, off)
      if (!namePart) break
      off = namePart.next
      if (!namePart.text) break
      name = namePart.text

      const typePart = readLengthPrefixedAscii(buffer, off)
      if (!typePart) break
      off = typePart.next
      type = typePart.text
    } else {
      const nameEnd = buffer.indexOf(0, off)
      if (nameEnd <= off) break
      name = buffer.toString('ascii', off, nameEnd)
      off = nameEnd + 1

      const typeEnd = buffer.indexOf(0, off)
      if (typeEnd <= off) break
      type = buffer.toString('ascii', off, typeEnd)
      off = typeEnd + 1
    }

    if (off + 4 > limit) break
    const size = buffer.readUInt32LE(off)
    off += 4

    const valStart = off
    if (size < 0 || valStart + size > limit) break
    off += size

    attrs.push({ name, type, value: buffer.subarray(valStart, valStart + size) })
  }

  return attrs
}

export function parseExrChannelsFromBuffer(buffer: Buffer): ExrHeaderChannel[] {
  for (const attr of walkExrAttributes(buffer)) {
    if (attr.name !== 'channels' || attr.type !== 'chlist') continue

    const channels: ExrHeaderChannel[] = []
    let p = 0
    const end = attr.value.length

    while (p < end) {
      const cnEnd = attr.value.indexOf(0, p)
      if (cnEnd < p) break
      if (cnEnd === p) break
      if (cnEnd >= end) break

      const name = attr.value.toString('ascii', p, cnEnd)
      p = cnEnd + 1
      if (p + 16 > end) break
      const pixelType = attr.value.readInt32LE(p)
      p += 16
      channels.push({ name, pixelType })
    }

    return channels
  }

  return []
}

function parseDimensionsFromAttrs(attrs: ExrAttribute[]): ExrDimensions | null {
  for (const key of ['dataWindow', 'displayWindow'] as const) {
    const attr = attrs.find((a) => a.name === key && a.type === 'box2i' && a.value.length === 16)
    if (!attr) continue
    const xmin = attr.value.readInt32LE(0)
    const ymin = attr.value.readInt32LE(4)
    const xmax = attr.value.readInt32LE(8)
    const ymax = attr.value.readInt32LE(12)
    const width = xmax - xmin + 1
    const height = ymax - ymin + 1
    if (width > 0 && height > 0) return { width, height }
  }
  return null
}

export function groupExrChannelsIntoLayers(headerChannels: ExrHeaderChannel[]): ExrLayerInfo[] {
  const groups = groupExrHeaderChannelNames(headerChannels.map((ch) => ch.name))

  return groups.map((g) => ({
    name: g.displayName,
    channels: g.channelSuffixes,
    previewable: g.channelSuffixes.length > 0,
    displayMode: detectExrAovDisplayMode(g.displayName, g.channelSuffixes)
  }))
}

function enrichExrFileMetadata(meta: ExrFileMetadata, fileSizeBytes?: number): ExrFileMetadata {
  const perLayer = meta.layerListIncomplete
    ? false
    : estimateExrsPerLayerPreviewAvailable(meta.width, meta.height, fileSizeBytes)
  const channelToggle = meta.layerListIncomplete
    ? false
    : estimateExrsChannelToggleAvailable(meta.width, meta.height, fileSizeBytes)

  const layers = meta.layers.map((l) => ({
    ...l,
    previewable: !meta.layerListIncomplete && perLayer && l.channels.length > 0
  }))

  const defaultLayerName = meta.layerListIncomplete
    ? EXR_DEFAULT_LAYER_NAME
    : pickExrDefaultLayerNameFromLayers(layers)

  return {
    ...meta,
    layers,
    layerListIncomplete: meta.layerListIncomplete ?? false,
    defaultLayerName,
    perLayerPreviewAvailable: perLayer,
    channelControlAvailable: channelToggle
  }
}

export function parseExrMetadataFromBuffer(buffer: Buffer, absPath?: string): ExrFileMetadata | null {
  const attrs = walkExrAttributes(buffer)
  const dims = parseDimensionsFromAttrs(attrs)
  if (!dims) return null

  const { multipart } = readExrVersionFlags(buffer)
  const headerChannels = parseExrChannelsFromBuffer(buffer)
  const layers =
    headerChannels.length > 0
      ? groupExrChannelsIntoLayers(headerChannels)
      : [
          {
            name: EXR_DEFAULT_LAYER_NAME,
            channels: ['R', 'G', 'B', 'A'],
            previewable: true,
            displayMode: 'hdr'
          }
        ]

  let fileSize: number | undefined
  if (absPath) {
    try {
      fileSize = statSync(absPath).size
    } catch {
      fileSize = undefined
    }
  }

  return enrichExrFileMetadata(
    {
      width: dims.width,
      height: dims.height,
      layers,
      layerListIncomplete: multipart || undefined,
      channelControlAvailable: false
    },
    fileSize
  )
}

export function parseExrDimensionsFromBuffer(buffer: Buffer): ExrDimensions | null {
  return parseDimensionsFromAttrs(walkExrAttributes(buffer))
}

export function parseExrDimensionsFromFile(absPath: string): ExrDimensions | null {
  try {
    const head = readExrHeaderBuffer(absPath)
    return parseExrDimensionsFromBuffer(head)
  } catch {
    return null
  }
}

export function estimateNapiChannelControlAvailable(
  absPath: string,
  dims?: ExrDimensions | null
): boolean {
  try {
    const size = statSync(absPath).size
    if (size > NAPI_DECODE_BYTE_BUDGET) return false
    const d = dims ?? parseExrDimensionsFromFile(absPath)
    if (!d) return false
    return d.width * d.height * 16 <= NAPI_DECODE_BYTE_BUDGET
  } catch {
    return false
  }
}

async function parseExrMetadataViaNapi(absPath: string): Promise<ExrFileMetadata | null> {
  const probe = await readExrNapiProbe(absPath)
  if (!probe) return null
  return enrichExrFileMetadata(
    {
      width: probe.width,
      height: probe.height,
      format: probe.format,
      colorType: probe.colorType,
      layerListIncomplete: true,
      layers: [
        {
          name: EXR_DEFAULT_LAYER_NAME,
          channels: ['R', 'G', 'B', 'A'],
          previewable: false,
          displayMode: 'hdr'
        }
      ],
      channelControlAvailable: false,
      probeSource: 'napi'
    },
    statSync(absPath).size
  )
}

export type ExrNapiProbe = {
  width: number
  height: number
  format?: string
  colorType?: number
}

/**
 * Image decode probe via @napi-rs/image — EXR has no JPEG/TIFF EXIF; this is the
 * equivalent metadata path used for raster imports (width/height/format/colorType).
 */
export async function readExrNapiProbe(absPath: string): Promise<ExrNapiProbe | null> {
  try {
    const fileSize = statSync(absPath).size
    if (fileSize > NAPI_DECODE_BYTE_BUDGET) return null
    const fileBuffer = readFileSync(absPath)
    const transformer = new Transformer(fileBuffer)
    const meta = await transformer.metadata()
    if (!meta.width || !meta.height) return null
    return {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      colorType: meta.colorType
    }
  } catch {
    return null
  }
}

function mergeExrMetadata(
  fromHeader: ExrFileMetadata | null,
  fromNapi: ExrFileMetadata | null,
  absPath: string
): ExrFileMetadata | null {
  if (fromHeader && fromNapi) {
    const dims = {
      width: fromHeader.width || fromNapi.width,
      height: fromHeader.height || fromNapi.height
    }
    return enrichExrFileMetadata(
      {
        ...fromHeader,
        ...dims,
        format: fromNapi.format ?? fromHeader.format,
        colorType: fromNapi.colorType ?? fromHeader.colorType,
        channelControlAvailable: false,
        probeSource: 'merged'
      },
      statSync(absPath).size
    )
  }
  if (fromHeader) {
    return enrichExrFileMetadata({ ...fromHeader, probeSource: 'header' }, statSync(absPath).size)
  }
  if (fromNapi) return enrichExrFileMetadata({ ...fromNapi, probeSource: 'napi' }, statSync(absPath).size)
  return null
}

export function exrStoredMetadataFromFileMeta(meta: ExrFileMetadata): ExrStoredMetadata {
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    colorType: meta.colorType,
    layerCount: meta.layers.length,
    layers: meta.layers.map((l) => ({ name: l.name, channels: l.channels })),
    probeSource: meta.probeSource ?? 'header'
  }
}

/** OpenEXR header (layers) + @napi-rs/image metadata probe, then downstream processing. */
export async function resolveExrFileMetadata(absPath: string): Promise<ExrFileMetadata | null> {
  let fromHeader: ExrFileMetadata | null = null
  try {
    const head = readExrHeaderBuffer(absPath)
    fromHeader = parseExrMetadataFromBuffer(head, absPath)
  } catch (e) {
    console.warn('[ExrMetadata] header read failed:', absPath, e)
  }

  const fromNapi = await parseExrMetadataViaNapi(absPath)
  return mergeExrMetadata(fromHeader, fromNapi, absPath)
}

/** @deprecated Use resolveExrFileMetadata */
export async function parseExrMetadataFromFile(absPath: string): Promise<ExrFileMetadata | null> {
  return resolveExrFileMetadata(absPath)
}

export async function resolveExrDimensionsForImport(
  absPath: string
): Promise<ExrDimensions | null> {
  const meta = await resolveExrFileMetadata(absPath)
  if (!meta) return null
  return { width: meta.width, height: meta.height }
}
