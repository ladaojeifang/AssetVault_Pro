import { mkdirSync, statSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  assertRemoteImageNotHotlinkPlaceholder,
  downloadRemoteUrlToFile
} from '../urlAssetImportService'
import { assertBundlePathInSessionDir, isAllowedBundleExtension } from './articleBundleSessionPathPolicy'

const MIN_REMOTE_IMAGE_BYTES = 2048

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

function mapRemoteDownloadError(e: unknown): Error {
  if (!(e instanceof Error)) return new Error('DOWNLOAD_FAILED')
  const msg = e.message
  if (msg === 'INVALID_URL' || msg === 'UNSUPPORTED_URL_SCHEME') return new Error('INVALID_REQUEST')
  if (msg === 'PAGE_VIDEO_USE_PAGE_VIDEO_IMPORT') return new Error('INVALID_REQUEST')
  if (msg.startsWith('DOWNLOAD_FAILED_')) return new Error(`DOWNLOAD_FAILED_${msg.replace('DOWNLOAD_FAILED_', '')}`)
  if (msg === 'DOWNLOAD_SIZE_EXCEEDED' || msg === 'DOWNLOAD_EMPTY_BODY') return new Error('INVALID_REQUEST')
  return e
}

/** Download remote URL into session tempDir at relativePath (creates parent dirs). */
export async function writeBundleFileFromRemoteUrl(
  tempDir: string,
  relativePath: string,
  sourceUrl: string,
  headers?: Record<string, string>
): Promise<string> {
  const rel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!rel || rel.includes('..')) {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }
  const outPath = join(tempDir, rel)
  if (!isAllowedBundleExtension(outPath)) {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }
  mkdirSync(dirname(outPath), { recursive: true })
  let contentType: string | null = null
  try {
    const downloaded = await downloadRemoteUrlToFile(sourceUrl, outPath, { headers })
    contentType = downloaded.contentType
  } catch (e) {
    throw mapRemoteDownloadError(e)
  }
  const st = statSync(outPath)
  if (st.size < MIN_REMOTE_IMAGE_BYTES) {
    throw new Error('INVALID_REQUEST')
  }
  try {
    assertRemoteImageNotHotlinkPlaceholder(sourceUrl, st.size, contentType)
  } catch {
    throw new Error('DOWNLOAD_HOTLINK_PLACEHOLDER')
  }
  return assertBundlePathInSessionDir(outPath, tempDir)
}
