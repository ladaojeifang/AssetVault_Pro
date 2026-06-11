import { statSync, readFileSync, mkdirSync, rmSync, existsSync, renameSync } from 'fs'
import { basename, extname, join, relative, sep } from 'path'
import { toCanonicalFilePath, isSqliteUniqueConstraintError } from '../utils/pathUtils'
import { v4 as uuidv4 } from 'uuid'
import mime from 'mime-types'
import { Transformer, ResizeFit } from '@napi-rs/image'
import ExifReader from 'exifreader'
import { getDatabase } from '../db'
import { assets, assetFolders } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import type { DuplicateImportAnswer, DuplicateImportPromptPayload, DuplicatePolicy, ImportAssetOptions } from '@/shared/importTypes'
import { getFileType } from '../utils/fileUtils'
import { computeFileSha256 } from '../utils/contentHash'
import { getThumbnailService } from './ThumbnailService'
import { FONT_THUMB_CANVAS_SIZE } from '../utils/fontPreviewRender'
import {
  getEffectiveThumbSampleText,
  getEffectiveThumbSampleVersion
} from './fontSettingsStore'
import { shouldUseOriginalImageDimensions } from '../utils/thumbnailSizing'
import { extractPaletteFromImageBuffer, serializePaletteColors } from '../utils/colorPalette'
import { classifyColorBucket } from '@/shared/colorBucket'
import { extractVideoFramePngBestEffort } from '../utils/videoFrame'
import { getLibraryMode } from './libraryManifest'
import {
  getLibraryRoot,
  itemPackFileRelative,
  itemThumbRelative,
  sanitizeStorageFileName
} from './libraryBundle'
import { copyOrHardlinkIntoLibrary } from './fileCopyIntoLibrary'
import { copyObjCompanionMtlForImport, posixRelToFsAbs } from './importSingleAssetHelpers'
import { syncAssetSidecarFromDb, writeAssetSidecarMeta } from './assetSidecar'
import { finalizeAssetRecords } from './assetSearchIndex'
import { parseFontFile } from './fontMetadata'
import { isModel3dPreviewExtension } from '@/shared/model3dFormats'
import { isEmbeddedDccThumbExtension } from '@/shared/embeddedDccFormats'
import { isTextPreviewExtension } from '@/shared/textPreviewFormats'
import { isSvgExtension, isSvgOverRasterLimit } from '@/shared/svgFormats'
import { isExrExtension } from '@/shared/exrFormats'
import { resolveExrFileMetadata, exrStoredMetadataFromFileMeta } from '../utils/exrMetadata'
import { parseSvgDimensions } from '../utils/svgDimensions'
import { markSvgRasterSkipped } from './svgRasterSkip'
import { schedule3dThumbnailAfterImport } from './regenerateModelThumbnails'
import { scheduleEmbeddedDccThumbnailAfterImport } from './regenerateEmbeddedDccThumbnails'
import { scheduleTextPreviewThumbnailAfterImport } from './regenerateTextPreviewThumbnails'
import { buildDuplicatePromptPayload, findAssetIdByContentHash } from './contentHashService'
import { resolveExistingThumbnailRelPath } from './thumbnailRead'
import { isEmbeddedInPlaceImport } from './embeddedAssetImport'

export interface ImportSingleAssetOptions extends ImportAssetOptions {
  resolveDuplicate?: (payload: Omit<DuplicateImportPromptPayload, 'requestId'>) => Promise<DuplicateImportAnswer>
}

function normalizeImportOptions(options?: string | ImportSingleAssetOptions): ImportSingleAssetOptions {
  if (typeof options === 'string') return { targetFolderId: options }
  return options ?? {}
}

/**
 * Import one file into the portable library: copy into items/{id}/{original filename}, write meta.json, index in SQLite.
 */
export async function importSingleAsset(
  filePath: string,
  options?: string | ImportSingleAssetOptions
): Promise<string | null> {
  const database = getDatabase()
  const opts = normalizeImportOptions(options)
  const targetFolderId = opts.targetFolderId
  const policy: DuplicatePolicy = opts.duplicatePolicy ?? 'ask'

  const filePathCanonical = toCanonicalFilePath(filePath)

  const dupSource = await database
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.importSource, filePathCanonical))
    .get()

  if (dupSource && policy !== 'import_copy') {
    console.log(`[Import] Same source path already imported, skipping: ${basename(filePathCanonical)}`)
    return linkExistingAsset(database, dupSource.id, targetFolderId)
  }

  const stat = statSync(filePathCanonical)
  const contentHash = await computeFileSha256(filePathCanonical)
  const hashDuplicateId = await findAssetIdByContentHash(database, stat.size, contentHash)

  if (hashDuplicateId) {
    if (policy === 'use_existing') {
      console.log(`[Import] Content hash match, using existing asset: ${basename(filePathCanonical)}`)
      return linkExistingAsset(database, hashDuplicateId, targetFolderId)
    }

    if (policy === 'ask') {
      if (opts.resolveDuplicate) {
        const promptPayload = await buildDuplicatePromptPayload(
          database,
          hashDuplicateId,
          filePathCanonical,
          contentHash,
          stat.size
        )
        const answer = await opts.resolveDuplicate(promptPayload)
        if (!answer || answer.resolution === 'cancel') {
          console.log(`[Import] User cancelled duplicate import: ${basename(filePathCanonical)}`)
          return null
        }
        if (answer.resolution === 'use_existing') {
          return linkExistingAsset(database, hashDuplicateId, targetFolderId)
        }
      } else {
        console.log(`[Import] Content duplicate, no prompt handler — importing copy: ${basename(filePathCanonical)}`)
      }
    }
  }

  const extWithDot = extname(filePathCanonical).toLowerCase()
  const extNoDot = extWithDot.replace(/^\./, '')
  const mimeType = mime.lookup(filePathCanonical) || 'application/octet-stream'
  const fileType = getFileType(mimeType, extWithDot)
  const filename = basename(filePathCanonical, extWithDot)
  const originalName = basename(filePathCanonical)
  const storageFileName = sanitizeStorageFileName(originalName)
  const id = opts.presetAssetId ?? uuidv4()
  const skipCopyIntoPack = opts.skipCopyIntoPack === true

  const libraryRoot = getLibraryRoot()
  const catalogMode = getLibraryMode() === 'catalog'
  const embeddedMode = getLibraryMode() === 'embedded'
  const itemDirAbs = join(libraryRoot, 'items', id)
  mkdirSync(itemDirAbs, { recursive: true })
  const remoteImportsRoot = toCanonicalFilePath(join(libraryRoot, 'remote-imports'))
  const remoteImportsPrefix = remoteImportsRoot.endsWith(sep)
    ? remoteImportsRoot
    : `${remoteImportsRoot}${sep}`
  const fromManagedRemoteImport =
    filePathCanonical === remoteImportsRoot || filePathCanonical.startsWith(remoteImportsPrefix)
  let importSourcePath = filePathCanonical

  let storedFilePath: string
  let destAbs: string
  let storageMode: 'local' | 'referenced' | 'embedded'

  if (embeddedMode) {
    if (isEmbeddedInPlaceImport(libraryRoot, filePathCanonical)) {
      const libraryRootNorm = toCanonicalFilePath(libraryRoot)
      storedFilePath = relative(libraryRootNorm, filePathCanonical).split(sep).join('/')
      destAbs = filePathCanonical
      importSourcePath = toCanonicalFilePath(filePathCanonical)
      storageMode = 'embedded'
    } else {
      const relOriginal = itemPackFileRelative(id, storageFileName)
      storedFilePath = relOriginal
      destAbs = posixRelToFsAbs(libraryRoot, relOriginal)
      if (skipCopyIntoPack) {
        if (toCanonicalFilePath(destAbs) !== filePathCanonical || !existsSync(destAbs)) {
          throw new Error('FILE_NOT_FOUND')
        }
      } else {
        copyOrHardlinkIntoLibrary(filePathCanonical, destAbs, true)
      }
      importSourcePath = toCanonicalFilePath(destAbs)
      storageMode = 'local'
    }
    if (extNoDot === 'obj') {
      copyObjCompanionMtlForImport(filePathCanonical, itemDirAbs)
    }
  } else if (catalogMode) {
    if (policy === 'import_copy' || fromManagedRemoteImport) {
      // In catalog mode, import_copy should create an actual local copy in items/{id}/
      // and mark it as local to keep localization semantics consistent.
      const relOriginal = itemPackFileRelative(id, storageFileName)
      const copyAbs = posixRelToFsAbs(libraryRoot, relOriginal)
      if (skipCopyIntoPack) {
        if (toCanonicalFilePath(copyAbs) !== filePathCanonical || !existsSync(copyAbs)) {
          throw new Error('FILE_NOT_FOUND')
        }
      } else if (fromManagedRemoteImport) {
        try {
          renameSync(filePathCanonical, copyAbs)
        } catch {
          copyOrHardlinkIntoLibrary(filePathCanonical, copyAbs, true)
        }
      } else {
        copyOrHardlinkIntoLibrary(filePathCanonical, copyAbs, true)
      }
      storedFilePath = relOriginal
      destAbs = copyAbs
      storageMode = 'local'
      importSourcePath = toCanonicalFilePath(copyAbs)
    } else {
      storedFilePath = filePathCanonical
      destAbs = filePathCanonical
      storageMode = 'referenced'
    }
  } else {
    const relOriginal = itemPackFileRelative(id, storageFileName)
    storedFilePath = relOriginal
    destAbs = posixRelToFsAbs(libraryRoot, relOriginal)
    if (skipCopyIntoPack) {
      if (toCanonicalFilePath(destAbs) !== filePathCanonical || !existsSync(destAbs)) {
        throw new Error('FILE_NOT_FOUND')
      }
    } else {
      copyOrHardlinkIntoLibrary(filePathCanonical, destAbs, true)
    }
    if (extNoDot === 'obj') {
      copyObjCompanionMtlForImport(filePathCanonical, itemDirAbs)
    }
    storageMode = 'local'
  }

  const hashComputedAt = new Date()

  let width: number | undefined
  let height: number | undefined
  let dominantColor: string | undefined
  let colorBucket: string | undefined
  let colors: string | undefined
  let duration: number | undefined
  let hasThumbnail = false
  let thumbnailPath: string | undefined
  let metadataObj: Record<string, unknown> = {}

  if (fileType === 'image') {
    try {
      if (isSvgExtension(extNoDot)) {
        if (isSvgOverRasterLimit(stat.size)) {
          markSvgRasterSkipped(id, `oversized:${stat.size}`)
        } else {
          const svgText = readFileSync(destAbs, 'utf-8')
          const dims = parseSvgDimensions(svgText)
          width = dims.width
          height = dims.height

          const thumb = await getThumbnailService().generate(
            destAbs,
            id,
            getThumbnailService().getGenerationDefaults()
          )
          if (thumb && !thumb.usedOriginal) {
            thumbnailPath = itemThumbRelative(id)
            hasThumbnail = true
            try {
              const palette = await extractPaletteFromImageBuffer(thumb.buffer)
              dominantColor = palette.dominantColor
              colorBucket = classifyColorBucket(palette.dominantColor) ?? undefined
              colors = serializePaletteColors(palette.colors)
            } catch {
              /* palette optional for SVG */
            }
          }
        }
      } else if (isExrExtension(extNoDot)) {
        const exrMeta = await resolveExrFileMetadata(destAbs)
        if (exrMeta) {
          width = exrMeta.width
          height = exrMeta.height
          metadataObj.exr = exrStoredMetadataFromFileMeta(exrMeta)
        }

        const thumb = await getThumbnailService().generate(
          destAbs,
          id,
          getThumbnailService().getGenerationDefaults()
        )
        if (thumb && !thumb.usedOriginal) {
          thumbnailPath = itemThumbRelative(id)
          hasThumbnail = true
          try {
            const palette = await extractPaletteFromImageBuffer(thumb.buffer)
            dominantColor = palette.dominantColor
            colorBucket = classifyColorBucket(palette.dominantColor) ?? undefined
            colors = serializePaletteColors(palette.colors)
          } catch {
            /* palette optional for EXR */
          }
        }
      } else {
        const fileBuffer = readFileSync(destAbs)
        const transformer = new Transformer(fileBuffer)
        const imgInfo = await transformer.metadata()
        width = imgInfo.width
        height = imgInfo.height

        if (!shouldUseOriginalImageDimensions(width, height)) {
          const thumb = await getThumbnailService().generate(
            destAbs,
            id,
            getThumbnailService().getGenerationDefaults()
          )
          if (thumb && !thumb.usedOriginal) {
            thumbnailPath = itemThumbRelative(id)
            hasThumbnail = true
          }
        }

        const palette = await extractPaletteFromImageBuffer(fileBuffer)
        dominantColor = palette.dominantColor
        colorBucket = classifyColorBucket(palette.dominantColor) ?? undefined
        colors = serializePaletteColors(palette.colors)

        try {
          const exifTags = await ExifReader.load(destAbs, { expanded: true })
          if (exifTags && typeof exifTags === 'object' && !Array.isArray(exifTags)) {
            metadataObj.exif = {}
            const tagMap = exifTags as unknown as Record<string, { value: unknown; description?: string }>
            for (const [key, val] of Object.entries(tagMap)) {
              if (val && typeof val === 'object' && 'value' in val) {
                ;(metadataObj.exif as Record<string, unknown>)[key] =
                  val.description ?? (val as { value: unknown }).value
              }
            }
          }
        } catch {
          // EXIF extraction failed
        }
      }
    } catch (error) {
      console.error('[Import] Image processing error:', error)
    }
  } else if (fileType === 'video') {
    try {
      const { parseFile } = await import('music-metadata')
      const mm = await parseFile(destAbs, { skipCovers: true, duration: true })
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
      // optional metadata
    }
    metadataObj.duration = duration ?? null
    try {
      // Always extract a poster frame; generateVideo skips resize when frame long edge < 256
      const thumb = await getThumbnailService().generateVideo(
        destAbs,
        id,
        getThumbnailService().getGenerationDefaults()
      )
      if (thumb) {
        thumbnailPath = itemThumbRelative(id)
        hasThumbnail = true
      }
      try {
        const frame = await extractVideoFramePngBestEffort(destAbs)
        if (frame) {
          const palette = await extractPaletteFromImageBuffer(frame)
          dominantColor = palette.dominantColor
          colorBucket = classifyColorBucket(palette.dominantColor) ?? undefined
          colors = serializePaletteColors(palette.colors)
        }
      } catch (colorErr) {
        console.error('[Import] Video color analysis error:', colorErr)
      }
    } catch (error) {
      console.error('[Import] Video thumbnail error:', error)
    }
  } else if (fileType === 'audio') {
    try {
      const { parseFile } = await import('music-metadata')
      const mm = await parseFile(destAbs, { skipCovers: true, duration: true })
      if (typeof mm.format.duration === 'number') duration = mm.format.duration
    } catch {
      // optional metadata
    }
    metadataObj.duration = duration ?? null
  } else if (fileType === 'font') {
    const parsed = parseFontFile(
      destAbs,
      getEffectiveThumbSampleText(),
      0,
      getEffectiveThumbSampleVersion()
    )
    if (parsed) {
      metadataObj.font = parsed
    }
    try {
      const thumb = await getThumbnailService().generateFont(destAbs, id, {
        width: FONT_THUMB_CANVAS_SIZE,
        height: FONT_THUMB_CANVAS_SIZE,
        quality: 85,
        sampleText: getEffectiveThumbSampleText(),
        ttcIndex: parsed?.ttcIndex ?? 0
      })
      if (thumb) {
        thumbnailPath = itemThumbRelative(id)
        hasThumbnail = true
      } else {
        console.warn(`[Import] Font thumbnail not generated for ${basename(filePathCanonical)}`)
      }
    } catch (error) {
      console.error('[Import] Font thumbnail error:', error)
    }
  }
  // 3D thumbnails run after DB + meta.json (see schedule3dThumbnailAfterImport) — rendering can take minutes
  // and must not block import; killing the app mid-render used to leave only items/{id}/original.* on disk.

  const insertValues = {
    id,
    filename: `${filename}${extWithDot}`,
    originalName,
    extension: extNoDot,
    mimeType,
    fileType,
    folderId: null,
    filePath: storedFilePath,
    storageMode,
    localizationState: 'idle',
    importSource: importSourcePath,
    fileSize: stat.size,
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
    fileCreatedAt: stat.birthtime,
    fileModifiedAt: stat.mtime
  } as any

  try {
    await database.insert(assets).values(insertValues)
  } catch (e) {
    const rowAfterError = await database.select().from(assets).where(eq(assets.id, id)).get()
    if (rowAfterError) {
      console.warn(`[Import] assets row exists after insert error, finishing sidecar: ${basename(filePathCanonical)}`, e)
      return await finalizeImportedAsset(database, {
        id,
        targetFolderId,
        fileType,
        destAbs,
        extNoDot,
        skipTextPreviewThumbnail: opts.skipTextPreviewThumbnail
      })
    }

    if (isSqliteUniqueConstraintError(e)) {
      let row = await database
        .select({ id: assets.id })
        .from(assets)
        .where(eq(assets.importSource, filePathCanonical))
        .get()
      if (!row) {
        row = await database
          .select({ id: assets.id })
          .from(assets)
          .where(eq(assets.filePath, storedFilePath))
          .get()
      }
      if (row) {
        console.log(`[Import] Already in library (race): ${basename(filePathCanonical)}`)
        try {
          removeOrphanItemDir(libraryRoot, id)
        } catch {
          /* ignore */
        }
        if (targetFolderId) {
          const existingAf = await database
            .select()
            .from(assetFolders)
            .where(and(eq(assetFolders.assetId, row.id), eq(assetFolders.folderId, targetFolderId)))
            .get()
          if (!existingAf) {
            await database.insert(assetFolders).values({ assetId: row.id, folderId: targetFolderId })
            await finalizeAssetRecords(database, row.id)
          }
        }
        return row.id
      }
    }
    try {
      removeOrphanItemDir(libraryRoot, id)
    } catch {
      /* ignore */
    }
    throw e
  }

  return await finalizeImportedAsset(database, {
    id,
    targetFolderId,
    fileType,
    destAbs,
    extNoDot,
    skipTextPreviewThumbnail: opts.skipTextPreviewThumbnail
  })
}

function shouldSkipTextPreviewThumbnail(
  assetId: string,
  skipRequested?: boolean
): boolean {
  if (skipRequested) return true
  return resolveExistingThumbnailRelPath(assetId) !== null
}

async function finalizeImportedAsset(
  database: ReturnType<typeof getDatabase>,
  opts: {
    id: string
    targetFolderId?: string
    fileType: string
    destAbs: string
    extNoDot: string
    skipTextPreviewThumbnail?: boolean
  }
): Promise<string> {
  const { id, targetFolderId, fileType, destAbs, extNoDot, skipTextPreviewThumbnail } = opts

  const row = await database.select().from(assets).where(eq(assets.id, id)).get()
  if (!row) {
    throw new Error(`[Import] Asset row missing after insert: ${id}`)
  }

  writeAssetSidecarMeta(row, [], [])

  if (targetFolderId) {
    try {
      const existingAf = await database
        .select()
        .from(assetFolders)
        .where(and(eq(assetFolders.assetId, id), eq(assetFolders.folderId, targetFolderId)))
        .get()
      if (!existingAf) {
        await database.insert(assetFolders).values({ assetId: id, folderId: targetFolderId })
      }
    } catch (folderErr) {
      console.error('[Import] folder assignment failed:', folderErr)
    }
  }

  await finalizeAssetRecords(database, id)

  if (fileType === '3d' && isModel3dPreviewExtension(extNoDot)) {
    void schedule3dThumbnailAfterImport(database, id, destAbs, extNoDot)
  } else if (fileType === '3d' && isEmbeddedDccThumbExtension('.' + extNoDot)) {
    void scheduleEmbeddedDccThumbnailAfterImport(database, id, destAbs, extNoDot)
  } else if (
    (fileType === 'code' || fileType === 'document') &&
    isTextPreviewExtension('.' + extNoDot) &&
    !shouldSkipTextPreviewThumbnail(id, skipTextPreviewThumbnail)
  ) {
    void scheduleTextPreviewThumbnailAfterImport(database, id, destAbs, extNoDot, fileType)
  }

  return id
}

function removeOrphanItemDir(libraryRoot: string, id: string): void {
  const dir = join(libraryRoot, 'items', id)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

async function linkExistingAsset(
  database: ReturnType<typeof getDatabase>,
  existingId: string,
  targetFolderId?: string
): Promise<string> {
  if (targetFolderId) {
    const existingAf = await database
      .select()
      .from(assetFolders)
      .where(and(eq(assetFolders.assetId, existingId), eq(assetFolders.folderId, targetFolderId)))
      .get()
    if (!existingAf) {
      await database.insert(assetFolders).values({ assetId: existingId, folderId: targetFolderId })
      await finalizeAssetRecords(database, existingId)
    }
  }
  return existingId
}
