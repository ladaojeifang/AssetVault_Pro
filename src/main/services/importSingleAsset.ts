import { statSync, readFileSync, mkdirSync, copyFileSync, rmSync, existsSync, readdirSync } from 'fs'
import { basename, dirname, extname, join, sep } from 'path'
import { toCanonicalFilePath, isSqliteUniqueConstraintError } from '../utils/pathUtils'
import { v4 as uuidv4 } from 'uuid'
import mime from 'mime-types'
import { Transformer, ResizeFit } from '@napi-rs/image'
import ExifReader from 'exifreader'
import { db, persistDatabase } from '../db'
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
import { extractVideoFramePngBestEffort } from '../utils/videoFrame'
import {
  getLibraryRoot,
  itemPackFileRelative,
  itemThumbRelative,
  sanitizeStorageFileName
} from './libraryBundle'
import { syncAssetSidecarFromDb, writeAssetSidecarMeta } from './assetSidecar'
import { isModelThumbnailSkipped, markModelThumbnailSkipped } from './modelThumbnailSkip'
import { buildDuplicatePromptPayload, findAssetIdByContentHash } from './contentHashService'
import { parseFontFile } from './fontMetadata'

export interface ImportSingleAssetOptions extends ImportAssetOptions {
  resolveDuplicate?: (payload: Omit<DuplicateImportPromptPayload, 'requestId'>) => Promise<DuplicateImportAnswer>
}

function normalizeImportOptions(options?: string | ImportSingleAssetOptions): ImportSingleAssetOptions {
  if (typeof options === 'string') return { targetFolderId: options }
  return options ?? {}
}

function posixRelToFsAbs(libraryRoot: string, rel: string): string {
  return join(libraryRoot, rel.split('/').join(sep))
}

/** Same basename as OBJ in the source folder, e.g. `chair.obj` → `chair.mtl`. */
function findCompanionMtlBesideObj(objPath: string): string | null {
  const dir = dirname(objPath)
  const base = basename(objPath, extname(objPath))
  const exact = join(dir, `${base}.mtl`)
  if (existsSync(exact)) return exact

  try {
    const want = `${base}.mtl`.toLowerCase()
    for (const name of readdirSync(dir)) {
      if (name.toLowerCase() === want) return join(dir, name)
    }
  } catch {
    /* ignore */
  }
  return null
}

function copyObjCompanionMtl(sourceObjPath: string, itemDirAbs: string): void {
  const mtlSource = findCompanionMtlBesideObj(sourceObjPath)
  if (!mtlSource) return

  const mtlName = sanitizeStorageFileName(basename(mtlSource))
  const mtlDest = join(itemDirAbs, mtlName)
  try {
    copyFileSync(mtlSource, mtlDest)
    console.log(`[Import] Copied companion MTL: ${mtlName}`)
  } catch (e) {
    console.warn(`[Import] Failed to copy companion MTL ${basename(mtlSource)}:`, e)
  }
}

/**
 * Import one file into the portable library: copy into items/{id}/{original filename}, write meta.json, index in SQLite.
 */
export async function importSingleAsset(
  filePath: string,
  options?: string | ImportSingleAssetOptions
): Promise<string | null> {
  const database = db!
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
  const relOriginal = itemPackFileRelative(id, storageFileName)
  const destAbs = posixRelToFsAbs(libraryRoot, relOriginal)
  const itemDirAbs = join(libraryRoot, 'items', id)
  mkdirSync(itemDirAbs, { recursive: true })
  copyFileSync(filePathCanonical, destAbs)
  if (extNoDot === 'obj') {
    copyObjCompanionMtl(filePathCanonical, itemDirAbs)
  }

  const hashComputedAt = new Date()

  let width: number | undefined
  let height: number | undefined
  let dominantColor: string | undefined
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
        const thumb = await getThumbnailService().generate(destAbs, id, {
          width: 256,
          height: 256,
          quality: 80
        })
        if (thumb && !thumb.usedOriginal) {
          thumbnailPath = itemThumbRelative(id)
          hasThumbnail = true
        }
      }

      const palette = await extractPaletteFromImageBuffer(fileBuffer)
      dominantColor = palette.dominantColor
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
      const thumb = await getThumbnailService().generateVideo(destAbs, id, {
        width: 256,
        height: 256,
        quality: 80
      })
      if (thumb) {
        thumbnailPath = itemThumbRelative(id)
        hasThumbnail = true
      }
      try {
        const frame = await extractVideoFramePngBestEffort(destAbs)
        if (frame) {
          const palette = await extractPaletteFromImageBuffer(frame)
          dominantColor = palette.dominantColor
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
    filePath: relOriginal,
    importSource: filePathCanonical,
    fileSize: stat.size,
    contentHash,
    contentHashComputedAt: hashComputedAt,
    width,
    height,
    dominantColor,
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

  if (fileType === '3d') {
    void schedule3dThumbnailAfterImport(database, id, destAbs, extNoDot)
  }

  persistDatabase()
  return id
}

/** Generate 3D thumb after import; updates DB + meta.json when done. */
export async function schedule3dThumbnailAfterImport(
  database: NonNullable<typeof db>,
  assetId: string,
  destAbs: string,
  extNoDot: string
): Promise<void> {
  if (isModelThumbnailSkipped(assetId)) return

  try {
    const thumb = await getThumbnailService().generateModel(destAbs, assetId, extNoDot, {
      width: 256,
      height: 256,
      quality: 80
    })
    if (!thumb) {
      markModelThumbnailSkipped(assetId)
      return
    }

    await database
      .update(assets)
      .set({
        thumbnailPath: itemThumbRelative(assetId),
        hasThumbnail: true,
        updatedAt: new Date()
      })
      .where(eq(assets.id, assetId))

    await syncAssetSidecarFromDb(database, assetId)
    persistDatabase()
  } catch (error) {
    markModelThumbnailSkipped(assetId)
    console.warn('[Import] 3D thumbnail skipped:', error)
  }
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
