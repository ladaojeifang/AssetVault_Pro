import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { assertBundlePathInSessionDir, isAllowedBundleExtension } from './articleBundleSessionPathPolicy'

function parseDataUrlPayload(dataUrl: string): Buffer {
  const m = dataUrl.match(/^data:([^;]*);base64,(.+)$/s)
  if (!m) throw new Error('INVALID_REQUEST')
  const b64 = m[2]?.replace(/\s/g, '') ?? ''
  if (!b64) throw new Error('INVALID_REQUEST')
  return Buffer.from(b64, 'base64')
}

/** Write bundle file bytes into session tempDir at relativePath (creates parent dirs). */
export function writeBundleFileFromDataUrl(
  tempDir: string,
  relativePath: string,
  fileDataUrl: string
): string {
  const rel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!rel || rel.includes('..')) {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }
  const outPath = join(tempDir, rel)
  if (!isAllowedBundleExtension(outPath)) {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }
  const bytes = parseDataUrlPayload(fileDataUrl)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, bytes)
  return assertBundlePathInSessionDir(outPath, tempDir)
}
