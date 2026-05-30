import { existsSync, mkdirSync, renameSync, copyFileSync, unlinkSync, writeFileSync } from 'fs'
import { join, extname, basename } from 'path'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import { ALL_SUPPORTED_IMPORT_EXTENSIONS } from '@/shared/supportedFormats'
import { getLibraryRoot, sanitizeStorageFileName } from './libraryBundle'
import { computeFileSha256 } from '../utils/contentHash'
import { toCanonicalFilePath } from '../utils/pathUtils'
import type { ApiImportOptions } from './assetImportService'
import { importAssetFromPath } from './assetImportService'
import type { AssetImportResult } from '@/shared/webApiTypes'

const REMOTE_IMPORTS_DIR = 'remote-imports'
const ABSOLUTE_MAX_BYTES = 300 * 1024 * 1024 // 300MB

type ParsedDataUrl = {
  mime: string
  base64: string
}

function parseDataUrl(dataUrl: string): ParsedDataUrl {
  // Accept: data:<mime>;base64,<payload>
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!m) throw new Error('INVALID_DATA_URL')
  const mime = m[1]?.toLowerCase().trim()
  const base64 = m[2]
  if (!mime || !base64) throw new Error('INVALID_DATA_URL')
  return { mime, base64 }
}

function extFromMime(mime: string): string | null {
  const mt = mime.toLowerCase().trim()
  switch (mt) {
    case 'image/png':
      return '.png'
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg'
    case 'image/webp':
      return '.webp'
    case 'image/gif':
      return '.gif'
    case 'image/bmp':
      return '.bmp'
    case 'image/svg+xml':
      return '.svg'
    default:
      return null
  }
}

function resolveExt(mime: string, filenameHint?: string): string | null {
  const extFromHint = filenameHint ? (filenameHint.startsWith('.') ? filenameHint : `.${filenameHint}`).toLowerCase().trim() : null
  if (extFromHint && ALL_SUPPORTED_IMPORT_EXTENSIONS.has(extFromHint)) return extFromHint
  const ext = extFromMime(mime)
  if (!ext) return null
  return ALL_SUPPORTED_IMPORT_EXTENSIONS.has(ext) ? ext : null
}

function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true })
}

function pickOriginalName(mime: string, filenameHint: string | undefined): string {
  if (filenameHint?.trim()) return filenameHint.trim()
  const ext = extFromMime(mime) ?? '.png'
  return `screenshot${ext}`
}

async function stableMoveIntoLibrary(options: {
  tmpPath: string
  sha256: string
  urlExt: string
  mime: string
  filenameHint?: string
}): Promise<string> {
  const libraryRoot = getLibraryRoot()
  const stableDir = join(libraryRoot, REMOTE_IMPORTS_DIR, options.sha256)
  ensureDir(stableDir)

  const originalName = pickOriginalName(options.mime, options.filenameHint)
  const safeName = sanitizeStorageFileName(originalName)
  const stablePath = join(stableDir, safeName)

  if (existsSync(stablePath)) {
    try {
      unlinkSync(options.tmpPath)
    } catch {
      /* ignore */
    }
    return stablePath
  }

  try {
    renameSync(options.tmpPath, stablePath)
  } catch {
    copyFileSync(options.tmpPath, stablePath)
    unlinkSync(options.tmpPath)
  }

  return stablePath
}

async function uniqueMoveIntoLibrary(options: { tmpPath: string; mime: string; filenameHint?: string }): Promise<string> {
  const libraryRoot = getLibraryRoot()
  const uniqueDir = join(libraryRoot, REMOTE_IMPORTS_DIR, `copy-${uuidv4()}`)
  ensureDir(uniqueDir)

  const originalName = pickOriginalName(options.mime, options.filenameHint)
  const safeName = sanitizeStorageFileName(originalName)
  const uniquePath = join(uniqueDir, safeName)

  try {
    renameSync(options.tmpPath, uniquePath)
  } catch {
    copyFileSync(options.tmpPath, uniquePath)
    unlinkSync(options.tmpPath)
  }

  return uniquePath
}

/**
 * Import asset from a `data:` URL (image screenshot result from extension).
 * It decodes to a file in temp, moves into library stable dir, then calls `importSingleAsset`.
 */
export async function importAssetFromDataUrl(
  dataUrl: string,
  options?: ApiImportOptions & { filename?: string }
): Promise<AssetImportResult> {
  const { mime, base64 } = parseDataUrl(dataUrl)
  const ext = resolveExt(mime, options?.filename)
  if (!ext) throw new Error('UNSUPPORTED_FILE_EXTENSION')

  // Decode and enforce size cap.
  const buf = Buffer.from(base64, 'base64')
  if (buf.byteLength > ABSOLUTE_MAX_BYTES) throw new Error('DOWNLOAD_SIZE_EXCEEDED')

  const tmpPath = join(tmpdir(), `assetvault-data-${uuidv4()}${ext}`)
  writeFileSync(tmpPath, buf)

  const policy = options?.duplicatePolicy
  let importPath: string
  if (policy === 'import_copy') {
    // For explicit copy imports, avoid stable hash path to prevent source-path dedupe.
    importPath = await uniqueMoveIntoLibrary({
      tmpPath,
      mime,
      filenameHint: options?.filename
    })
  } else {
    const sha256 = await computeFileSha256(tmpPath)
    importPath = await stableMoveIntoLibrary({
      tmpPath,
      sha256,
      urlExt: ext,
      mime,
      filenameHint: options?.filename
    })
  }

  const canonicalImportPath = toCanonicalFilePath(importPath)
  return importAssetFromPath(canonicalImportPath, {
    targetFolderId: options?.targetFolderId,
    duplicatePolicy: policy
  })
}

