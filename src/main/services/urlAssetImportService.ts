import { existsSync, mkdirSync, renameSync, copyFileSync, unlinkSync, createWriteStream } from 'fs'
import { join, extname, basename } from 'path'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import { ALL_SUPPORTED_IMPORT_EXTENSIONS } from '@/shared/supportedFormats'
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
  options?: ApiImportOptions & { filename?: string }
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

  const controller = new AbortController()
  const res = await fetch(url, { redirect: 'follow', signal: controller.signal })
  if (!res.ok) throw new Error(`DOWNLOAD_FAILED_${res.status}`)

  const contentLength = parseContentLength(res.headers.get('content-length'))
  const contentType = res.headers.get('content-type')
  const contentTypeBase = contentType ? contentType.split(';')[0].trim() : null

  const maxBytes = resolveMaxBytesFromContentLength(contentLength)
  const resolvedExt = resolveExtensionForDownload(parsed, options?.filename, contentTypeBase)
  if (!resolvedExt || !ALL_SUPPORTED_IMPORT_EXTENSIONS.has(resolvedExt)) {
    throw new Error('UNSUPPORTED_FILE_EXTENSION')
  }

  // Stream download to a temp file.
  const tempPath = join(tmpdir(), `assetvault-url-${uuidv4()}${resolvedExt}`)
  await streamFetchToFile(res, tempPath, maxBytes, controller)

  // Move to a stable location inside the active library so catalog mode can reference it safely.
  const sha256 = await computeFileSha256(tempPath)
  const stablePath = await moveIntoLibraryStableImport(tempPath, sha256, parsed, resolvedExt, options?.filename)

  const canonicalStablePath = toCanonicalFilePath(stablePath)
  return importAssetFromPath(canonicalStablePath, {
    targetFolderId: options?.targetFolderId,
    duplicatePolicy: options?.duplicatePolicy
  })
}

export type ImportFromUrlBatchItem = { url: string; filename?: string }

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
      const result = await importAssetFromUrl(item.url, { ...options, filename: item.filename })
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
          msg === 'DOWNLOAD_SIZE_EXCEEDED'
            ? '下载文件超过最大限制'
            : msg === 'UNSUPPORTED_FILE_EXTENSION'
              ? '不支持的文件扩展名'
              : msg
      })
    }
  }

  return { imported, skipped, errors }
}

