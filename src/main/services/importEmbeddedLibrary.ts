import {
  existsSync,
  statSync,
  readdirSync,
  mkdirSync,
  writeFileSync
} from 'fs'
import { join, relative, extname, basename, normalize, sep } from 'path'
import { v4 as uuidv4 } from 'uuid'
import mime from 'mime-types'
import type { BrowserWindow } from 'electron'
import { getDatabase, flushDatabase, withSqliteTransaction } from '../db'
import { assets } from '../db/schema'
import { eq } from 'drizzle-orm'
import { ALL_SUPPORTED_IMPORT_EXTENSIONS } from '@/shared/supportedFormats'
import type { CreateEmbeddedLibraryResult, EmbeddedImportProgress } from '@/shared/libraryTypes'
import { getFileType } from '../utils/fileUtils'
import { systemTypeCategoryId } from '@/shared/assetTypeRegistry'
import { resolveFormatCapabilities } from '@/shared/formatCapabilities'
import { computeFileSha256 } from '../utils/contentHash'
import { getThumbnailService } from './ThumbnailService'
import {
  writeLibraryManifest,
  setLibraryModeForSession
} from './libraryManifest'
import {
  getLibraryRoot,
  ensureLibraryDirectories,
  ITEMS_DIR,
  LIBRARY_DB_NAME,
  MANIFEST_NAME,
  itemThumbRelative,
  toLibraryRelativeIfUnderRoot
} from './libraryBundle'
import { switchActiveLibrary } from './librarySwitch'
import { writeAssetSidecarMeta } from './assetSidecar'
import { finalizeAssetRecords } from './assetSearchIndex'
import { findAssetIdByContentHash } from './contentHashService'
import { parseFontFile } from './fontMetadata'
import { extractPaletteFromImageBuffer, serializePaletteColors } from '../utils/colorPalette'
import { classifyColorBucket } from '@/shared/colorBucket'
import { Transformer } from '@napi-rs/image'
import { FONT_THUMB_CANVAS_SIZE } from '../utils/fontPreviewRender'
import {
  getEffectiveThumbSampleText,
  getEffectiveThumbSampleVersion
} from './fontSettingsStore'
import { shouldUseOriginalImageDimensions } from '../utils/thumbnailSizing'
import { extractVideoFramePngBestEffort } from '../utils/videoFrame'
import { isSvgOverRasterLimit } from '@/shared/svgFormats'
import { resolveExrFileMetadata, exrStoredMetadataFromFileMeta } from '../utils/exrMetadata'
import { parseSvgDimensions } from '../utils/svgDimensions'
import { markSvgRasterSkipped } from './svgRasterSkip'
import { scheduleDeferredThumbnailAfterImport } from './thumbnailJobs'

let importInProgress = false

function emitProgress(win: BrowserWindow | undefined, progress: EmbeddedImportProgress): void {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send('embedded-import:progress', progress)
    }
  } catch {
    /* ignore */
  }
}

interface ScanEntry {
  absPath: string
  relPath: string
  ext: string
  size: number
  mtime: Date
}

/**
 * Synchronously scan a folder for supported assets.
 * @param root      — the parent folder containing user's files
 * @param skipDir   — absolute path of a subdirectory to exclude (e.g. the libraryRoot metadata folder)
 * @param win       — optional BrowserWindow for progress events
 */
function scanFolder(root: string, skipDir?: string, win?: BrowserWindow): ScanEntry[] {
  const entries: ScanEntry[] = []
  const skipDirNorm = skipDir ? normalize(skipDir) : undefined

  function walk(dir: string) {
    let items: import('fs').Dirent<string>[]
    try {
      items = readdirSync(dir, { withFileTypes: true, encoding: 'utf8' }) as import('fs').Dirent<string>[]
    } catch {
      return
    }

    for (const item of items) {
      const abs = join(dir, item.name)
      const absNorm = normalize(abs)

      // Skip hidden files/dirs, library infrastructure subdir, items/, library.sqlite, manifest.json
      if (item.name.startsWith('.')) continue
      if (skipDirNorm && absNorm === skipDirNorm) continue
      if (item.name === ITEMS_DIR && absNorm === normalize(join(root, ITEMS_DIR))) continue
      if (item.name === LIBRARY_DB_NAME && absNorm === normalize(join(root, LIBRARY_DB_NAME))) continue
      if (item.name === MANIFEST_NAME && absNorm === normalize(join(root, MANIFEST_NAME))) continue

      if (item.isDirectory()) {
        walk(abs)
      } else if (item.isFile()) {
        const ext = extname(item.name).toLowerCase()
        if (!ALL_SUPPORTED_IMPORT_EXTENSIONS.has(ext)) continue

        let stat: ReturnType<typeof statSync>
        try {
          stat = statSync(abs)
        } catch {
          continue
        }
        if (stat.size === 0) continue
        if (!stat.isFile()) continue

        const rel = relative(root, abs).split(sep).join('/')
        entries.push({ absPath: normalize(abs), relPath: rel, ext, size: stat.size, mtime: stat.mtime })
      }
    }
  }

  walk(root)

  // Sort by relative path for reproducible order
  entries.sort((a, b) => a.relPath.localeCompare(b.relPath))

  return entries
}

export async function createEmbeddedLibrary(
  folderPathRaw: string,
  options?: { win?: BrowserWindow }
): Promise<CreateEmbeddedLibraryResult> {
  if (importInProgress) {
    return { ok: false, error: '已有内嵌库创建任务正在进行', code: 'ALREADY_EMBEDDED' }
  }

  importInProgress = true
  const win = options?.win

  let previousRoot: string | null = null
  try {
    // Record the current library before switching, so we can rollback on failure
    try {
      previousRoot = getLibraryRoot()
    } catch {
      previousRoot = null
    }

    const root = normalize(folderPathRaw.trim())
    if (!root || !existsSync(root)) {
      return { ok: false, error: '路径不存在', code: 'INVALID_PATH' }
    }
    const rootStat = statSync(root)
    if (!rootStat.isDirectory()) {
      return { ok: false, error: '不是文件夹', code: 'INVALID_PATH' }
    }

    // Check if already a library
    const manifestPath = join(root, MANIFEST_NAME)
    const dbPath = join(root, LIBRARY_DB_NAME)
    if (existsSync(manifestPath) && existsSync(dbPath)) {
      const raw = JSON.parse(require('fs').readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>
      if (raw.libraryMode === 'embedded') {
        return { ok: false, error: '该文件夹已是内嵌资料库', code: 'ALREADY_EMBEDDED' }
      }
      return { ok: false, error: '该文件夹已是其他类型资料库，不支持覆盖为内嵌库', code: 'WRONG_MODE' }
    }

    // Check writability
    try {
      mkdirSync(root, { recursive: true })
    } catch {
      return { ok: false, error: '文件夹不可写', code: 'NOT_WRITABLE' }
    }

    // Create a dedicated subfolder inside the selected folder
    // to isolate library infrastructure (manifest, DB, items/).
    const folderName = basename(root)
    const libDirName = `${folderName}-${uuidv4().split('-')[0]}`
    const libraryRoot = join(root, libDirName)

    // Create skeleton and switch active library BEFORE import,
    // so getDatabase() returns the new library's DB (not the current one).
    ensureLibraryDirectories(libraryRoot)
    writeLibraryManifest(libraryRoot, { libraryMode: 'embedded', displayName: folderName })
    const switchResult = await switchActiveLibrary(libraryRoot)
    if (!switchResult.ok) {
      importInProgress = false
      return { ok: false, error: switchResult.error }
    }

    // Phase 1: Scan — scan the parent folder, excluding the libraryRoot metadata subfolder
    emitProgress(win, { phase: 'scan', current: 0, total: 1, filename: '', status: 'processing' })
    const entries = scanFolder(root, libraryRoot, win)
    // Recompute relPath to be relative to libraryRoot (not parent folder)
    for (const entry of entries) {
      entry.relPath = relative(libraryRoot, entry.absPath).split(sep).join('/')
    }
    emitProgress(win, { phase: 'scan', current: 1, total: 1, filename: '', status: 'done' })

    if (entries.length === 0) {
      // Already created skeleton & switched — just set session mode
      setLibraryModeForSession('embedded')
      return {
        ok: true,
        libraryRoot,
        assetsAdded: 0,
        assetsSkippedDuplicate: 0,
        assetsFailed: 0,
        errors: []
      }
    }

    // Phase 2: Import
    emitProgress(win, { phase: 'import', current: 0, total: entries.length, filename: '', status: 'processing' })

    const database = getDatabase()
    const thumbService = getThumbnailService()
    const errors: Array<{ filename: string; reason: string }> = []
    let added = 0
    let skippedDuplicate = 0
    let failed = 0

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!

      if (i > 0 && i % 20 === 0) {
        await new Promise<void>((resolve) => setImmediate(resolve))
      }

      emitProgress(win, {
        phase: 'import',
        current: i + 1,
        total: entries.length,
        filename: basename(entry.absPath),
        status: 'processing'
      })

      try {
        // Dedup check: import_source (based on absolute path at import time)
        const existingBySource = await database
          .select({ id: assets.id })
          .from(assets)
          .where(eq(assets.importSource, entry.absPath))
          .get()

        if (existingBySource) {
          // Same source path already imported — skip
          skippedDuplicate++
          continue
        }

        // Content hash dedup
        const contentHash = await computeFileSha256(entry.absPath)
        const existingByHash = await findAssetIdByContentHash(database, entry.size, contentHash)
        if (existingByHash) {
          skippedDuplicate++
          continue
        }

        // Extract metadata
        const mimeType = mime.lookup(entry.absPath) || 'application/octet-stream'
        const extNoDot = entry.ext.replace(/^\./, '')
        const fileType = getFileType(mimeType, entry.ext)
        const formatCaps = resolveFormatCapabilities(extNoDot)
        const filename = basename(entry.absPath, entry.ext)
        const originalName = basename(entry.absPath)
        const id = uuidv4()

        // Ensure items/{id}/ directory
        const itemDir = join(libraryRoot, ITEMS_DIR, id)
        mkdirSync(itemDir, { recursive: true })

        let width: number | undefined
        let height: number | undefined
        let dominantColor: string | undefined
        let colorBucket: string | undefined
        let colors: string | undefined
        let duration: number | undefined
        let hasThumbnail = false
        let thumbnailPath: string | undefined
        let metadataObj: Record<string, unknown> = {}

        if (formatCaps.importPipeline === 'image') {
          try {
            if (formatCaps.imagePipeline === 'svg') {
              const svgText = require('fs').readFileSync(entry.absPath, 'utf-8')
              const dims = parseSvgDimensions(svgText)
              width = dims.width
              height = dims.height

              if (isSvgOverRasterLimit(entry.size)) {
                markSvgRasterSkipped(id, `oversized:${entry.size}`)
              } else {
                const thumb = await thumbService.generate(entry.absPath, id, thumbService.getGenerationDefaults())
                if (thumb && !thumb.usedOriginal) {
                  thumbnailPath = itemThumbRelative(id)
                  hasThumbnail = true
                  try {
                    const palette = await extractPaletteFromImageBuffer(thumb.buffer)
                    dominantColor = palette.dominantColor
                    colorBucket = classifyColorBucket(palette.dominantColor) ?? undefined
                    colors = serializePaletteColors(palette.colors)
                  } catch {
                    /* optional */
                  }
                }
              }
            } else if (formatCaps.imagePipeline === 'exr') {
              const exrMeta = await resolveExrFileMetadata(entry.absPath)
              if (exrMeta) {
                width = exrMeta.width
                height = exrMeta.height
                metadataObj.exr = exrStoredMetadataFromFileMeta(exrMeta)
              }
              const thumb = await thumbService.generate(entry.absPath, id, thumbService.getGenerationDefaults())
              if (thumb && !thumb.usedOriginal) {
                thumbnailPath = itemThumbRelative(id)
                hasThumbnail = true
                try {
                  const palette = await extractPaletteFromImageBuffer(thumb.buffer)
                  dominantColor = palette.dominantColor
                  colorBucket = classifyColorBucket(palette.dominantColor) ?? undefined
                  colors = serializePaletteColors(palette.colors)
                } catch {
                  /* optional */
                }
              }
            } else {
              const fileBuffer = require('fs').readFileSync(entry.absPath)
              const transformer = new Transformer(fileBuffer)
              const imgInfo = await transformer.metadata()
              width = imgInfo.width
              height = imgInfo.height

              if (!shouldUseOriginalImageDimensions(width, height)) {
                const thumb = await thumbService.generate(entry.absPath, id, thumbService.getGenerationDefaults())
                if (thumb && !thumb.usedOriginal) {
                  thumbnailPath = itemThumbRelative(id)
                  hasThumbnail = true
                }
              }

              const palette = await extractPaletteFromImageBuffer(fileBuffer)
              dominantColor = palette.dominantColor
              colorBucket = classifyColorBucket(palette.dominantColor) ?? undefined
              colors = serializePaletteColors(palette.colors)
            }
          } catch (imgErr) {
            console.error(`[EmbeddedLib] image processing error for ${entry.absPath}:`, imgErr)
          }
        } else if (formatCaps.importPipeline === 'video') {
          try {
            const { parseFile } = await import('music-metadata')
            const mm = await parseFile(entry.absPath, { skipCovers: true, duration: true })
            if (typeof mm.format.duration === 'number') duration = mm.format.duration
            for (const ti of mm.format.trackInfo) {
              if (ti.video) {
                const v = ti.video
                const w = v.displayWidth ?? v.pixelWidth
                const h = v.displayHeight ?? v.pixelHeight
                if (typeof w === 'number') width = w
                if (typeof h === 'number') height = h
                break
              }
            }
          } catch {
            /* optional */
          }
          metadataObj.duration = duration ?? null
          try {
            const thumb = await thumbService.generateVideo(entry.absPath, id, thumbService.getGenerationDefaults())
            if (thumb) {
              thumbnailPath = itemThumbRelative(id)
              hasThumbnail = true
            }
            try {
              const frame = await extractVideoFramePngBestEffort(entry.absPath)
              if (frame) {
                const palette = await extractPaletteFromImageBuffer(frame)
                dominantColor = palette.dominantColor
                colorBucket = classifyColorBucket(palette.dominantColor) ?? undefined
                colors = serializePaletteColors(palette.colors)
              }
            } catch {
              /* optional */
            }
          } catch {
            /* optional */
          }
        } else if (formatCaps.importPipeline === 'audio') {
          try {
            const { parseFile } = await import('music-metadata')
            const mm = await parseFile(entry.absPath, { skipCovers: true, duration: true })
            if (typeof mm.format.duration === 'number') duration = mm.format.duration
          } catch {
            /* optional */
          }
          metadataObj.duration = duration ?? null
        } else if (formatCaps.importPipeline === 'font') {
          const parsed = parseFontFile(
            entry.absPath,
            getEffectiveThumbSampleText(),
            0,
            getEffectiveThumbSampleVersion()
          )
          if (parsed) {
            metadataObj.font = parsed
          }
          try {
            const thumb = await thumbService.generateFont(entry.absPath, id, {
              width: FONT_THUMB_CANVAS_SIZE,
              height: FONT_THUMB_CANVAS_SIZE,
              quality: 85,
              sampleText: getEffectiveThumbSampleText(),
              ttcIndex: parsed?.ttcIndex ?? 0
            })
            if (thumb) {
              thumbnailPath = itemThumbRelative(id)
              hasThumbnail = true
            }
          } catch {
            /* optional */
          }
        }

        const hashComputedAt = new Date()

        // Write DB row
        const insertValues = {
          id,
          filename: `${filename}${entry.ext}`,
          originalName,
          extension: extNoDot,
          mimeType,
          fileType,
          typeId: systemTypeCategoryId(fileType),
          folderId: null,
          filePath: entry.relPath, // relative to library root (forward slashes)
          storageMode: 'embedded' as const,
          localizationState: 'idle' as const,
          importSource: entry.absPath,
          fileSize: entry.size,
          contentHash,
          contentHashComputedAt: hashComputedAt,
          width,
          height,
          dominantColor,
          colorBucket,
          colors,
          duration,
          thumbnailPath,
          hasThumbnail,
          metadata: Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : null,
          fileCreatedAt: entry.mtime,
          fileModifiedAt: entry.mtime
        } as any

        await withSqliteTransaction(async () => {
          await database.insert(assets).values(insertValues)
          const row = await database.select().from(assets).where(eq(assets.id, id)).get()
          if (row) {
            writeAssetSidecarMeta(row, [], [], libraryRoot)
            await finalizeAssetRecords(database, id)
          }
        })

        if (formatCaps.asyncThumbnail) {
          scheduleDeferredThumbnailAfterImport(database, id, entry.absPath, extNoDot)
        }

        added++
      } catch (e) {
        failed++
        errors.push({
          filename: basename(entry.absPath),
          reason: e instanceof Error ? e.message : String(e)
        })
      }
    }

    emitProgress(win, {
      phase: 'import',
      current: entries.length,
      total: entries.length,
      filename: '',
      status: 'done'
    })

    // Phase 3: Finalize
    emitProgress(win, { phase: 'finalize', current: 0, total: 1, filename: '', status: 'processing' })

    ensureLibraryDirectories(libraryRoot)
    writeLibraryManifest(libraryRoot, { libraryMode: 'embedded', displayName: folderName })
    setLibraryModeForSession('embedded')

    await flushDatabase()

    emitProgress(win, { phase: 'finalize', current: 1, total: 1, filename: '', status: 'done' })

    return {
      ok: true,
      libraryRoot,
      assetsAdded: added,
      assetsSkippedDuplicate: skippedDuplicate,
      assetsFailed: failed,
      errors
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[EmbeddedLib] create failed:', e)
    // Rollback: switch back to the previous library if we already switched
    if (previousRoot) {
      try {
        await switchActiveLibrary(previousRoot)
      } catch (rollbackErr) {
        console.error('[EmbeddedLib] rollback failed:', rollbackErr)
      }
    }
    return { ok: false, error: msg }
  } finally {
    importInProgress = false
  }
}
