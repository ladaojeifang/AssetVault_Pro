import { open, readFile } from 'fs/promises'
import { wrapDibToBmp } from './bmpCodec'
import type { EmbeddedExtractResult } from './types'

const DEFAULT = { chunkSize: 1024 * 1024, overlap: 64 }

export async function extractC4dEmbedded(
  filePath: string,
  opts: { chunkSize?: number; overlap?: number } = {}
): Promise<EmbeddedExtractResult> {
  const { chunkSize, overlap } = { ...DEFAULT, ...opts }
  const fh = await open(filePath, 'r')
  const startPattern = Buffer.from([0xff, 0xd8, 0xff])
  const endPattern = Buffer.from([0xff, 0xd9])

  try {
    const stat = await fh.stat()
    let offset = 0
    let previousTail = Buffer.alloc(0)
    let recording = false
    const chunks: Buffer[] = []

    while (offset < stat.size) {
      const toRead = Math.min(chunkSize, stat.size - offset)
      const buf = Buffer.alloc(toRead)
      const { bytesRead } = await fh.read(buf, 0, toRead, offset)
      if (!bytesRead) break

      const chunk = bytesRead === buf.length ? buf : buf.subarray(0, bytesRead)
      const window = previousTail.length ? Buffer.concat([previousTail, chunk]) : chunk

      if (!recording) {
        const startIdx = window.indexOf(startPattern)
        if (startIdx !== -1) {
          const endIdx = window.indexOf(endPattern, startIdx + 3)
          if (endIdx !== -1) {
            const jpg = window.subarray(startIdx, endIdx + 2)
            return { ok: true, format: 'c4d', buffer: jpg, mime: 'image/jpeg' }
          }
          recording = true
          chunks.push(window.subarray(startIdx))
        }
      } else {
        const endIdx = window.indexOf(endPattern)
        if (endIdx !== -1) {
          const adjusted = endIdx - previousTail.length
          if (adjusted >= 0) chunks.push(chunk.subarray(0, adjusted + 2))
          const jpg = Buffer.concat(chunks)
          return { ok: true, format: 'c4d', buffer: jpg, mime: 'image/jpeg' }
        }
        chunks.push(chunk)
      }

      previousTail = chunk.subarray(Math.max(0, chunk.length - overlap))
      offset += bytesRead
    }

    return { ok: false, format: 'c4d', error: 'jpeg-not-found' }
  } finally {
    await fh.close()
  }
}

export interface DibCandidate {
  offset: number
  width: number
  height: number
  bpp: number
}

const DIB_SIG = Buffer.from([0x28, 0x00, 0x00, 0x00])

export function parseDibCandidates(buf: Buffer): DibCandidate[] {
  const out: DibCandidate[] = []
  let idx = buf.indexOf(DIB_SIG)
  while (idx !== -1) {
    if (idx + 40 <= buf.length) {
      const width = buf.readInt32LE(idx + 4)
      const height = buf.readInt32LE(idx + 8)
      const planes = buf.readUInt16LE(idx + 12)
      const bpp = buf.readUInt16LE(idx + 14)
      if (width >= 16 && width <= 4096 && height >= 16 && height <= 4096 && planes === 1 && (bpp === 24 || bpp === 32)) {
        out.push({ offset: idx, width, height, bpp })
      }
    }
    idx = buf.indexOf(DIB_SIG, idx + 4)
  }
  return out
}

export function pickLargestDib(candidates: DibCandidate[]): DibCandidate | null {
  if (!candidates.length) return null
  return candidates.sort((a, b) => b.width * b.height - a.width * a.height)[0]
}

export async function extractMaxEmbedded(filePath: string): Promise<EmbeddedExtractResult> {
  const data = await readFile(filePath)
  const candidates = parseDibCandidates(data)
  const best = pickLargestDib(candidates)

  if (!best) return { ok: false, format: 'max', error: 'dib-not-found' }

  const rowSize = Math.floor((best.width * best.bpp + 31) / 32) * 4
  const pixelBytes = rowSize * best.height
  const dibSize = 40 + pixelBytes
  if (best.offset + dibSize > data.length) {
    return { ok: false, format: 'max', error: 'dib-out-of-range' }
  }

  const dib = data.subarray(best.offset, best.offset + dibSize)
  const bmp = wrapDibToBmp(dib)
  return { ok: true, format: 'max', buffer: bmp, mime: 'image/bmp', width: best.width, height: best.height }
}
