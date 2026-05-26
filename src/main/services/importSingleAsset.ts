import { statSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { basename, extname, join } from 'path'
import { toCanonicalFilePath, isSqliteUniqueConstraintError } from '../utils/pathUtils'
import { v4 as uuidv4 } from 'uuid'
import mime from 'mime-types'
import { Transformer, ResizeFit } from '@napi-rs/image'
import ExifReader from 'exifreader'
import { getDatabase, persistDatabase } from '../db'
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
import { parseFontFile } from './fontMetadata'
import { isModel3dPreviewExtension } from '@/shared/model3dFormats'
import { schedule3dThumbnailAfterImport } from './regenerateModelThumbnails'
import { buildDuplicatePromptPayload, findAssetIdByContentHash } from './contentHashService'

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

  const filePathCanonical = toCanonicalFilePath(filePath)

  const dupSource = await database
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.importSource, filePathCanonical))
    .get()

  if (dupSource) {
    console.log(`[Import] Same source path already imported, skipping: ${basename(filePathCanonical)}`)
    return linkExistingAsset(database, dupSource.id, targetFolderId)
  }

  const stat = statSync(filePathCanonical)
  const contentHash = await computeFileSha256(filePathCanonical)
  const hashDuplicateId = await findAssetIdByContentHash(database, stat.size, contentHash)

  if (hashDuplicateId) {
    const policy: DuplicatePolicy = opts.duplicatePolicy ?? 'ask'

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
  const id = uuidv4()

  const libraryRoot = getLibraryRoot()
  const catalogMode = getLibraryMode() === 'catalog'
  const itemDirAbs = join(libraryRoot, 'items', id)
  mkdirSync(itemDirAbs, { recursive: true })

  let storedFilePath: string
  let destAbs: string
  let storageMode: 'local' | 'referenced'

  if (catalogMode) {
    storedFilePath = filePathCanonical
    destAbs = filePathCanonical
    storageMode = 'referenced'
  } else {
    const relOriginal = itemPackFileRelative(id, storageFileName)
    storedFilePath = relOriginal
    destAbs = posixRelToFsAbs(libraryRoot, relOriginal)
    copyOrHardlinkIntoLibrary(filePathCanonical, destAbs, true)
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
        const exifTags = ExifReader.load(destAbs, { expanded: true })
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
    importSource: filePathCanonical,
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
        extNoDot
      })
    }

    if (isSqliteUniqueConstraintError(e)) {
      const row = await database
        .select({ id: assets.id })
        .from(assets)
        .where(eq(assets.importSource, filePathCanonical))
        .get()
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
            persistDatabase()
            await syncAssetSidecarFromDb(database, row.id)
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
    extNoDot
  })
}

async function finalizeImportedAsset(
  database: NonNullable<typeof db>,
  opts: {
    id: string
    targetFolderId?: string
    fileType: string
    destAbs: string
    extNoDot: string
  }
): Promise<string> {
  const { id, targetFolderId, fileType, destAbs, extNoDot } = opts

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

  await syncAssetSidecarFromDb(database, id)

  if (fileType === '3d' && isModel3dPreviewExtension(extNoDot)) {
    void schedule3dThumbnailAfterImport(database, id, destAbs, extNoDot)
  }

  persistDatabase()
  return id
}

function removeOrphanItemDir(libraryRoot: string, id: string): void {
  const dir = join(libraryRoot, 'items', id)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

async function linkExistingAsset(
  database: NonNullable<typeof db>,
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
      persistDatabase()
      await syncAssetSidecarFromDb(database, existingId)
    }
  }
  return existingId
}
