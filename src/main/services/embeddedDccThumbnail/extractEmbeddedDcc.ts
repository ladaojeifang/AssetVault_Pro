import { extname } from 'path'
import { open } from 'fs/promises'
import { isBlendHeader, isC4DHeader, isGzip, isHipHeader, isOle } from './magic'
import { extractBlendEmbedded } from './extractBlend'
import { extractC4dEmbedded, extractMaxEmbedded } from './extractC4dMax'
import type { EmbeddedExtractResult } from './types'

async function readHead(filePath: string, bytes = 64): Promise<Buffer> {
  const fh = await open(filePath, 'r')
  try {
    const stat = await fh.stat()
    const size = Math.min(bytes, stat.size)
    const buf = Buffer.alloc(size)
    await fh.read(buf, 0, size, 0)
    return buf
  } finally {
    await fh.close()
  }
}

export async function extractEmbeddedDccThumbnail(filePath: string): Promise<EmbeddedExtractResult> {
  const head = await readHead(filePath, 64)
  const ext = extname(filePath).toLowerCase()

  if (ext === '.hip' || isHipHeader(head)) {
    return { ok: false, error: 'hip-has-no-embedded-thumbnail-by-default' }
  }

  if (ext === '.c4d' || isC4DHeader(head)) {
    return extractC4dEmbedded(filePath)
  }
  if (ext === '.max' || isOle(head)) {
    return extractMaxEmbedded(filePath)
  }
  if (ext === '.blend' || isGzip(head) || isBlendHeader(head)) {
    return extractBlendEmbedded(filePath)
  }

  return { ok: false, error: 'unsupported-format' }
}
