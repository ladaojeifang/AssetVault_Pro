import { existsSync, mkdirSync, readFileSync, renameSync, copyFileSync, unlinkSync, createWriteStream } from 'fs'
import { join, extname, basename, dirname } from 'path'
import { tmpdir } from 'os'
import http from 'http'
import https from 'https'
import { v4 as uuidv4 } from 'uuid'
import { ALL_SUPPORTED_IMPORT_EXTENSIONS } from '@/shared/supportedFormats'
import { isPageVideoWorkUrl } from '@/shared/pageVideoUrlPolicy'
import type { AssetImportFromUrlBatchResponse, AssetImportResult } from '@/shared/webApiTypes'
import { getLibraryRoot, sanitizeStorageFileName } from './libraryBundle'
import { computeFileSha256 } from '../utils/contentHash'
import { toCanonicalFilePath } from '../utils/pathUtils'
import type { ApiImportOptions } from './assetImportService'
import { importAssetFromPath } from './assetImportService'

const REMOTE_IMPORTS_DIR = 'remote-imports'

// Download sizing policy:
// - If `Content-Length` exists, we derive an adaptive max.
// - If the derived max is exceeded, we abort download and throw immediately.
// - Otherwise, we fall back to a hard cap.
const ABSOLUTE_MAX_BYTES = 300 * 1024 * 1024 // 300MB
const CONTENT_LENGTH_HEADROOM = Math.ceil(1024 * 1024) // +1MB
const CONTENT_LENGTH_MULTIPLIER = 1.15
const MIN_ADAPTIVE_BYTES = 5 * 1024 * 1024 // 5MB

function parseContentLength(headerValue: string | null): number | null {
  if (!headerValue) return null
  const n = Number.parseInt(headerValue, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function resolveMaxBytesFromContentLength(contentLength: number | null): number {
  if (!contentLength) return ABSOLUTE_MAX_BYTES
  if (contentLength > ABSOLUTE_MAX_BYTES) {
    // Pre-check for fast failure (no streaming).
    throw new Error('DOWNLOAD_SIZE_EXCEEDED')
  }
  return Math.max(
    MIN_ADAPTIVE_BYTES,
    Math.min(ABSOLUTE_MAX_BYTES, Math.ceil(contentLength * CONTENT_LENGTH_MULTIPLIER) + CONTENT_LENGTH_HEADROOM)
  )
}

function normalizeExt(extHint: string | undefined): string | null {
  if (!extHint) return null
  const ext = extHint.startsWith('.') ? extHint.toLowerCase() : `.${extHint.toLowerCase()}`
  return ext
}

function pickOriginalName(url: URL, originalFilenameHint: string | undefined, resolvedExt: string): string {
  if (originalFilenameHint && originalFilenameHint.trim()) {
    const b = basename(originalFilenameHint.trim())
    // Ensure extension is consistent (importSingleAsset relies on ext for classification).
    return b.includes('.') ? b : `${b}${resolvedExt}`
  }
  const pathnameBase = basename(url.pathname)
  if (pathnameBase && pathnameBase.includes('.')) return pathnameBase
  return `download${resolvedExt}`
}

function resolveExtensionForDownload(url: URL, filenameHint: string | undefined, contentType: string | null): string | null {
  const extFromHint = normalizeExt(filenameHint ? extname(filenameHint) : undefined)
  if (extFromHint && ALL_SUPPORTED_IMPORT_EXTENSIONS.has(extFromHint)) return extFromHint

  const extFromUrl = normalizeExt(extname(url.pathname))
  if (extFromUrl && ALL_SUPPORTED_IMPORT_EXTENSIONS.has(extFromUrl)) return extFromUrl

  // Fallback by content-type (best-effort).
  if (contentType) {
    const ct = contentType.toLowerCase().trim()
    if (ct.includes('exr')) return '.exr'
    if (ct.startsWith('image/')) return '.jpg'
    if (ct.startsWith('video/')) return '.mp4'
    if (ct.startsWith('audio/')) return '.mp3'
    if (ct.includes('font/')) return '.ttf'
  }
  return null
}

function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true })
}

async function moveIntoLibraryStableImport(
  tempPath: string,
  contentSha256: string,
  url: URL,
  resolvedExt: string,
  filenameHint?: string
): Promise<string> {
  const libraryRoot = getLibraryRoot()
  const stableDir = join(libraryRoot, REMOTE_IMPORTS_DIR, contentSha256)
  ensureDir(stableDir)

  const originalName = pickOriginalName(url, filenameHint, resolvedExt)
  const safeName = sanitizeStorageFileName(originalName)
  const stablePath = join(stableDir, safeName)

  if (existsSync(stablePath)) {
    try {
      unlinkSync(tempPath)
    } catch {
      /* ignore */
    }
    return stablePath
  }

  try {
    renameSync(tempPath, stablePath)
  } catch {
    // Fallback: cross-device rename can fail.
    copyFileSync(tempPath, stablePath)
    unlinkSync(tempPath)
  }
  return stablePath
}

async function streamFetchToFile(res: Response, filePath: string, maxBytes: number, controller: AbortController): Promise<void> {
  if (!res.body) throw new Error('DOWNLOAD_EMPTY_BODY')
  const writer = createWriteStream(filePath)
  let downloaded = 0

  try {
    const reader = res.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      downloaded += value.byteLength
      if (downloaded > maxBytes) {
        controller.abort()
        throw new Error('DOWNLOAD_SIZE_EXCEEDED')
      }
      const ok = writer.write(Buffer.from(value))
      if (!ok) await new Promise<void>((resolve) => writer.once('drain', resolve))
    }

    await new Promise<void>((resolve, reject) => {
      writer.once('finish', () => resolve())
      writer.once('error', reject)
      writer.end()
    })
  } catch (e) {
    try {
      writer.destroy()
    } catch {
      /* ignore */
    }
    try {
      if (existsSync(filePath)) unlinkSync(filePath)
    } catch {
      /* ignore */
    }
    throw e
  }
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const MAX_REDIRECTS = 8
const DOWNLOAD_TIMEOUT_MS = 120_000

function formatDownloadError(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const cause = (e as Error & { cause?: unknown }).cause
  if (cause instanceof Error && cause.message && cause.message !== e.message) {
    return `${e.message}: ${cause.message}`
  }
  return e.message
}

function mergeDownloadHeaders(url: URL, headers?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    Referer: `${url.protocol}//${url.host}/`
  }
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      if (k && v) out[k] = v
    }
  }
  return out
}

async function streamNodeResponseToFile(
  res: http.IncomingMessage,
  filePath: string,
  maxBytes: number
): Promise<void> {
  const writer = createWriteStream(filePath)
  let downloaded = 0

  await new Promise<void>((resolve, reject) => {
    const cleanup = (err?: Error) => {
      res.destroy()
      try {
        writer.destroy()
      } catch {
        /* ignore */
      }
      try {
        if (existsSync(filePath)) unlinkSync(filePath)
      } catch {
        /* ignore */
      }
      if (err) reject(err)
    }

    res.on('data', (chunk: Buffer) => {
      downloaded += chunk.byteLength
      if (downloaded > maxBytes) {
        cleanup(new Error('DOWNLOAD_SIZE_EXCEEDED'))
        return
      }
      const ok = writer.write(chunk)
      if (!ok) res.pause()
    })
    writer.on('drain', () => res.resume())
    res.on('error', (err) => cleanup(err instanceof Error ? err : new Error(String(err))))
    writer.on('error', (err) => cleanup(err))
    res.on('end', () => {
      writer.end(() => resolve())
    })
  })
}

async function downloadUrlWithNodeHttp(
  url: URL,
  filePath: string,
  headers: Record<string, string>,
  maxBytes: number,
  redirectCount = 0
): Promise<{ contentType: string | null; contentLength: number | null }> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error('DOWNLOAD_TOO_MANY_REDIRECTS')
  }

  const transport = url.protocol === 'https:' ? https : http

  return await new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method: 'GET',
        headers,
        timeout: DOWNLOAD_TIMEOUT_MS
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          const next = new URL(res.headers.location, url)
          void downloadUrlWithNodeHttp(next, filePath, headers, maxBytes, redirectCount + 1)
            .then(resolve)
            .catch(reject)
          return
        }
        if (status < 200 || status >= 300) {
          res.resume()
          reject(new Error(`DOWNLOAD_FAILED_${status}`))
          return
        }

        const contentType = res.headers['content-type']
          ? String(res.headers['content-type']).split(';')[0].trim()
          : null
        const contentLengthRaw = res.headers['content-length']
        const contentLength =
          contentLengthRaw != null ? parseContentLength(String(contentLengthRaw)) : null

        void streamNodeResponseToFile(res, filePath, maxBytes)
          .then(() => resolve({ contentType, contentLength }))
          .catch(reject)
      }
    )

    req.on('timeout', () => {
      req.destroy(new Error('DOWNLOAD_TIMEOUT'))
    })
    req.on('error', (err) => {
      reject(new Error(`DOWNLOAD_NETWORK_ERROR:${formatDownloadError(err)}`))
    })
    req.end()
  })
}

const ALLOWED_DOWNLOAD_HEADERS = new Set(['referer', 'user-agent', 'accept', 'accept-language'])

function sanitizeDownloadHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!k || typeof v !== 'string') continue
    const key = k.toLowerCase().trim()
    if (!ALLOWED_DOWNLOAD_HEADERS.has(key)) continue
    const val = v.trim()
    if (!val) continue
    if (key === 'referer') out.Referer = val
    else if (key === 'user-agent') out['User-Agent'] = val
    else if (key === 'accept') out.Accept = val
    else if (key === 'accept-language') out['Accept-Language'] = val
  }
  return Object.keys(out).length ? out : undefined
}

/** Reject anti-hotlink placeholder responses (e.g. pc520 GIF watermark for .jpg URLs). */
export function assertRemoteImageNotHotlinkPlaceholder(
  sourceUrl: string,
  bytes: number,
  contentType: string | null
): void {
  const ct = (contentType || '').toLowerCase()
  const expectRaster = /\.(?:jpe?g|png|webp|avif)$/i.test(sourceUrl)
  if (!expectRaster) return
  if (ct.includes('gif') && bytes < 96 * 1024) {
    throw new Error('DOWNLOAD_HOTLINK_PLACEHOLDER')
  }
  if (bytes < 12_288) {
    throw new Error('DOWNLOAD_HOTLINK_PLACEHOLDER')
  }
}

/** Download URL in main-process and return a data URL (for bundle / preview; does not import). */
export async function fetchRemoteUrlBody(
  url: string,
  options?: { headers?: Record<string, string> }
): Promise<{ dataUrl: string; bytes: number; contentType: string | null }> {
  const tempPath = join(tmpdir(), `assetvault-fetch-${uuidv4()}.bin`)
  try {
    const { contentType } = await downloadRemoteUrlToFile(url, tempPath, options)
    const buf = readFileSync(tempPath)
    assertRemoteImageNotHotlinkPlaceholder(url, buf.length, contentType)
    const mime = contentType?.split(';')[0]?.trim() || 'application/octet-stream'
    return {
      dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
      bytes: buf.length,
      contentType
    }
  } finally {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath)
    } catch {
      /* ignore */
    }
  }
}

/** Download http(s) URL to an existing destination path (creates parent dirs). */
export async function downloadRemoteUrlToFile(
  url: string,
  destPath: string,
  options?: { filename?: string; headers?: Record<string, string> }
): Promise<{ contentType: string | null; contentLength: number | null }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('INVALID_URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('UNSUPPORTED_URL_SCHEME')
  }
  if (isPageVideoWorkUrl(url)) {
    throw new Error('PAGE_VIDEO_USE_PAGE_VIDEO_IMPORT')
  }
  mkdirSync(dirname(destPath), { recursive: true })
  return downloadUrlToTempFile(parsed, destPath, options)
}

async function downloadUrlToTempFile(
  url: URL,
  tempPath: string,
  options?: { filename?: string; headers?: Record<string, string> }
): Promise<{ contentType: string | null; contentLength: number | null }> {
  const mergedHeaders = mergeDownloadHeaders(url, sanitizeDownloadHeaders(options?.headers))

  // Prefer Node http(s): Electron main-process fetch often fails with opaque "fetch failed".
  let nodeErr: unknown
  try {
    const headLength = await probeContentLength(url, mergedHeaders)
    const maxBytes = resolveMaxBytesFromContentLength(headLength)
    return await downloadUrlWithNodeHttp(url, tempPath, mergedHeaders, maxBytes)
  } catch (e) {
    nodeErr = e
    console.warn('[URL Import] Node download failed, trying fetch fallback:', e)
  }

  try {
    const controller = new AbortController()
    const res = await fetch(url.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: mergedHeaders
    })
    if (!res.ok) throw new Error(`DOWNLOAD_FAILED_${res.status}`)

    const contentLength = parseContentLength(res.headers.get('content-length'))
    const contentType = res.headers.get('content-type')
    const contentTypeBase = contentType ? contentType.split(';')[0].trim() : null
    const maxBytes = resolveMaxBytesFromContentLength(contentLength)
    await streamFetchToFile(res, tempPath, maxBytes, controller)
    return { contentType: contentTypeBase, contentLength }
  } catch (fetchErr) {
    if (nodeErr) throw nodeErr
    throw fetchErr
  }
}

function probeContentLength(url: URL, headers: Record<string, string>): Promise<number | null> {
  const transport = url.protocol === 'https:' ? https : http
  return new Promise((resolve) => {
    const req = transport.request(
      url,
      { method: 'HEAD', headers, timeout: 15_000 },
      (res) => {
        res.resume()
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try {
            const next = new URL(res.headers.location, url)
            void probeContentLength(next, headers).then(resolve)
          } catch {
            resolve(null)
          }
          return
        }
        resolve(parseContentLength(res.headers['content-length'] ? String(res.headers['content-length']) : null))
      }
    )
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
    req.on('error', () => resolve(null))
    req.end()
  })
}

/**
 * Import a remote URL by downloading it in main-process, enforcing a size cap (adaptive from Content-Length),
 * and importing the downloaded file into the current library.
 *
 * Two-step workflow:
 * - Import returns assetId(s)
 * - Tag assignment uses existing `/tag/assign`
 */

export async function importAssetFromUrl(
  url: string,
  options?: ApiImportOptions & { filename?: string; headers?: Record<string, string> }
): Promise<AssetImportResult> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('INVALID_URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('UNSUPPORTED_URL_SCHEME')
  }

  if (isPageVideoWorkUrl(url)) {
    throw new Error('PAGE_VIDEO_USE_PAGE_VIDEO_IMPORT')
  }

  // Resolve extension before download (best-effort from hint/url).
  const extFromHint = resolveExtensionForDownload(parsed, options?.filename, null)
  if (!extFromHint) {
    // Still allow download; content-type from response may resolve extension.
  }

  const tempPath = join(tmpdir(), `assetvault-url-${uuidv4()}${extFromHint ?? '.bin'}`)
  let contentType: string | null = null
  try {
    const downloaded = await downloadUrlToTempFile(parsed, tempPath, options)
    contentType = downloaded.contentType
  } catch (e) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath)
    } catch {
      /* ignore */
    }
    throw e
  }

  const resolvedExt = resolveExtensionForDownload(parsed, options?.filename, contentType)
  if (!resolvedExt || !ALL_SUPPORTED_IMPORT_EXTENSIONS.has(resolvedExt)) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath)
    } catch {
      /* ignore */
    }
    throw new Error('UNSUPPORTED_FILE_EXTENSION')
  }

  let finalTempPath = tempPath
  if (extFromHint !== resolvedExt) {
    finalTempPath = join(tmpdir(), `assetvault-url-${uuidv4()}${resolvedExt}`)
    renameSync(tempPath, finalTempPath)
  }

  // Move to a stable location inside the active library so catalog mode can reference it safely.
  const sha256 = await computeFileSha256(finalTempPath)
  const stablePath = await moveIntoLibraryStableImport(finalTempPath, sha256, parsed, resolvedExt, options?.filename)

  const canonicalStablePath = toCanonicalFilePath(stablePath)
  return importAssetFromPath(canonicalStablePath, {
    targetFolderId: options?.targetFolderId,
    duplicatePolicy: options?.duplicatePolicy
  })
}

export type ImportFromUrlBatchItem = { url: string; filename?: string; headers?: Record<string, string> }

export async function importAssetFromUrlBatch(
  items: ImportFromUrlBatchItem[],
  options?: ApiImportOptions & { concurrent?: number }
): Promise<AssetImportFromUrlBatchResponse> {
  const imported: string[] = []
  const skipped: AssetImportFromUrlBatchResponse['skipped'] = []
  const errors: AssetImportFromUrlBatchResponse['errors'] = []

  // Sequential by default (predictable disk/network usage; easy to debug).
  for (const item of items) {
    try {
      const result = await importAssetFromUrl(item.url, {
        ...options,
        filename: item.filename,
        headers: item.headers ?? options?.headers
      })
      if (result.skipped) {
        skipped.push({ url: item.url, reason: result.reason ?? 'skipped', existingAssetId: result.existingAssetId })
      } else if (result.assetId) {
        imported.push(result.assetId)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({
        url: item.url,
        message:
          msg === 'PAGE_VIDEO_USE_PAGE_VIDEO_IMPORT'
            ? '作品页视频请使用 POST /asset/pageVideoImport'
            : msg === 'DOWNLOAD_SIZE_EXCEEDED'
              ? '下载文件超过最大限制'
              : msg === 'UNSUPPORTED_FILE_EXTENSION'
                ? '不支持的文件扩展名'
                : msg
      })
    }
  }

  return { imported, skipped, errors }
}

