import { gunzipSync } from 'zlib'
import { readFile } from 'fs/promises'
import { isBlendHeader, isGzip } from './magic'
import { rgbaToBGRA, rgbaToBmp } from './bmpCodec'
import type { EmbeddedExtractResult } from './types'

async function gunzipMaybe(filePath: string): Promise<Buffer> {
  const raw = await readFile(filePath)
  if (isGzip(raw)) return gunzipSync(raw)
  return raw
}

function parseBlendTestBlock(data: Buffer): EmbeddedExtractResult {
  if (!isBlendHeader(data)) return { ok: false, format: 'blend', error: 'not-blend' }

  const pointerSize = data[7] === 0x2d ? 8 : 4
  const little = data[8] === 0x76
  const i32 = (off: number) => (little ? data.readInt32LE(off) : data.readInt32BE(off))
  let offset = 12

  while (offset + 8 <= data.length) {
    const code = data.subarray(offset, offset + 4).toString('ascii')
    if (code === 'ENDB') break
    const size = i32(offset + 4)
    const headerSize = 16 + pointerSize
    const bodyStart = offset + headerSize
    const bodyEnd = bodyStart + size
    if (bodyEnd > data.length) break

    if (code === 'TEST') {
      const raw = data.subarray(bodyStart, bodyEnd)
      const w = little ? raw.readInt32LE(0) : raw.readInt32BE(0)
      const h = little ? raw.readInt32LE(4) : raw.readInt32BE(4)
      const rgba = raw.subarray(8)
      if (w > 0 && h > 0 && rgba.length >= w * h * 4) {
        const bgra = rgbaToBGRA(rgba.subarray(0, w * h * 4))
        const bmp = rgbaToBmp(w, h, bgra)
        return { ok: true, format: 'blend', buffer: bmp, mime: 'image/bmp', width: w, height: h }
      }
    }
    offset = bodyEnd
  }

  return { ok: false, format: 'blend', error: 'test-block-not-found' }
}

export async function extractBlendEmbedded(filePath: string): Promise<EmbeddedExtractResult> {
  const data = await gunzipMaybe(filePath)
  return parseBlendTestBlock(data)
}
