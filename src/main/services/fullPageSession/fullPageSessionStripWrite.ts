import { writeFileSync } from 'fs'
import { join } from 'path'
import {
  assertStripPathInSessionDir,
  fullPageStripFileName
} from './fullPageSessionPathPolicy'
import type { FullPageOutputFormat } from '@/shared/fullPageSessionTypes'

function parseDataUrlPayload(dataUrl: string): { mime: string; bytes: Buffer } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s)
  if (!m) throw new Error('INVALID_REQUEST')
  const mime = m[1]?.toLowerCase().trim() || 'image/jpeg'
  const b64 = m[2]?.replace(/\s/g, '') ?? ''
  if (!b64) throw new Error('INVALID_REQUEST')
  return { mime, bytes: Buffer.from(b64, 'base64') }
}

export function writeStripFromDataUrl(
  tempDir: string,
  stripIndex: number,
  stripDataUrl: string,
  format: FullPageOutputFormat
): string {
  const { bytes } = parseDataUrlPayload(stripDataUrl)
  const name = fullPageStripFileName(stripIndex, format)
  const outPath = join(tempDir, name)
  writeFileSync(outPath, bytes)
  return assertStripPathInSessionDir(outPath, tempDir)
}
