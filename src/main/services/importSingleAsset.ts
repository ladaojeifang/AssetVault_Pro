import { statSync, readFileSync } from 'fs'
import { basename, extname } from 'path'
import { toCanonicalFilePath, isSqliteUniqueFilePathError } from '../utils/pathUtils'
import { v4 as uuidv4 } from 'uuid'
import mime from 'mime-types'
import { Transformer, ResizeFit } from '@napi-rs/image'
import ExifReader from 'exifreader'
import { db, persistDatabase } from '../db'
import { assets, assetsSearch } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getFileType } from '../utils/fileUtils'
import { getThumbnailService } from './ThumbnailService'

/**
 * Import one file into the library (DB + thumbnail + search index).
 * Used by IPC batch import and by the file watcher.
 */
export async function importSingleAsset(
  filePath: string,
  targetFolderId?: string
): Promise<string | null> {
  const database = db!

  const filePathCanonical = toCanonicalFilePath(filePath)

  const existing = await database
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.filePath, filePathCanonical))
    .get()

  if (existing) {
    console.log(`[Import] File already exists, skipping: ${basename(filePathCanonical)}`)
    return existing.id
  }

  const stat = statSync(filePathCanonical)
  const ext = extname(filePathCanonical).toLowerCase()
  const mimeType = mime.lookup(filePathCanonical) || 'application/octet-stream'
  const fileType = getFileType(mimeType, ext)
  const filename = basename(filePathCanonical, ext)
  const id = uuidv4()

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
      const fileBuffer = readFileSync(filePathCanonical)
      const transformer = new Transformer(fileBuffer)
      const imgInfo = await transformer.metadata()
      width = imgInfo.width
      height = imgInfo.height

      const thumb = await getThumbnailService().generate(filePathCanonical, id, {
        width: 256,
        height: 256,
        quality: 80
      })
      if (thumb) {
        thumbnailPath = thumb.path
        hasThumbnail = true
      }

      const colorTransformer = new Transformer(fileBuffer)
      const colorBuffer = await colorTransformer.resize(1, 1, undefined, ResizeFit.Inside).rawPixels()
      dominantColor =
        '#' +
        [colorBuffer[0], colorBuffer[1], colorBuffer[2]]
          .map((v: number) => Math.round(v).toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase()

      try {
        const exifTags = ExifReader.load(filePathCanonical, { expanded: true })
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
      const mm = await parseFile(filePathCanonical, { skipCovers: true, duration: true })
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
      const thumb = await getThumbnailService().generateVideo(filePathCanonical, id, {
        width: 256,
        height: 256,
        quality: 80
      })
      if (thumb) {
        thumbnailPath = thumb.path
        hasThumbnail = true
      }
    } catch (error) {
      console.error('[Import] Video thumbnail error:', error)
    }
  } else if (fileType === 'audio') {
    try {
      const { parseFile } = await import('music-metadata')
      const mm = await parseFile(filePathCanonical, { skipCovers: true, duration: true })
      if (typeof mm.format.duration === 'number') duration = mm.format.duration
    } catch {
      // optional metadata
    }
    metadataObj.duration = duration ?? null
  }

  const insertValues = {
    id,
    filename: `${filename}${ext}`,
    originalName: basename(filePathCanonical),
    extension: ext.replace('.', ''),
    mimeType,
    fileType,
    folderId: targetFolderId || null,
    filePath: filePathCanonical,
    fileSize: stat.size,
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
    if (isSqliteUniqueFilePathError(e)) {
      const row = await database
        .select({ id: assets.id })
        .from(assets)
        .where(eq(assets.filePath, filePathCanonical))
        .get()
      if (row) {
        console.log(`[Import] Already in library (race or duplicate path): ${basename(filePathCanonical)}`)
        return row.id
      }
    }
    throw e
  }

  const existingSearch = await database
    .select({ assetId: assetsSearch.assetId })
    .from(assetsSearch)
    .where(eq(assetsSearch.assetId, id))
    .get()

  if (!existingSearch) {
    await database.insert(assetsSearch).values({
      assetId: id,
      searchText: `${filename} ${basename(filePathCanonical)}`
    })
  }

  persistDatabase()
  return id
}
