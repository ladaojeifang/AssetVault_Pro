import { existsSync, readdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'
import { eq } from 'drizzle-orm'
import mime from 'mime-types'
import { getDatabase, persistDatabase } from '../db'
import { assets } from '../db/schema'
import { getLibraryRoot, itemPackFileRelative, ITEMS_DIR } from './libraryBundle'
import { getFileType } from '../utils/fileUtils'
import { writeAssetSidecarMeta, syncAssetSidecarFromDb } from './assetSidecar'
import { schedule3dThumbnailAfterImport } from './regenerateModelThumbnails'
import { isModelThumbnailSkipped } from './modelThumbnailSkip'
import { isModel3dPreviewExtension } from '@/shared/model3dFormats'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Recover items/{id}/original.* folders that were copied but never got meta.json / DB rows
 * (e.g. import interrupted during 3D thumbnail generation).
 */
export async function repairOrphanItemPacks(): Promise<number> {
  const libraryRoot = getLibraryRoot()
  const itemsRoot = join(libraryRoot, ITEMS_DIR)
  if (!existsSync(itemsRoot)) return 0

  const database = getDatabase()
  let repaired = 0

  for (const entry of readdirSync(itemsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !UUID_RE.test(entry.name)) continue

    const id = entry.name
    const itemDir = join(itemsRoot, id)
    if (existsSync(join(itemDir, 'meta.json'))) continue

    const packFiles = readdirSync(itemDir).filter(
      (n) => n !== 'meta.json' && n !== 'thumb.webp' && !n.startsWith('.')
    )
    if (packFiles.length === 0) continue

    const origName = packFiles[0]
    const extNoDot = extname(origName).replace(/^\./, '').toLowerCase()
    if (!extNoDot) continue

    const origAbs = join(itemDir, origName)
    if (!existsSync(origAbs)) continue

    const existing = await database.select().from(assets).where(eq(assets.id, id)).get()
    if (existing) {
      await syncAssetSidecarFromDb(database, id)
      if (
        existing.fileType === '3d' &&
        isModel3dPreviewExtension(extNoDot) &&
        !existing.hasThumbnail &&
        !isModelThumbnailSkipped(id)
      ) {
        void schedule3dThumbnailAfterImport(database, id, origAbs, extNoDot)
      }
      repaired++
      continue
    }

    try {
      const stat = statSync(origAbs)
      const extWithDot = `.${extNoDot}`
      const mimeType = mime.lookup(origAbs) || 'application/octet-stream'
      const fileType = getFileType(mimeType, extWithDot)
      const relOriginal = itemPackFileRelative(id, origName)
      const displayName = origName

      const now = new Date()
      await database.insert(assets).values({
        id,
        filename: displayName,
        originalName: displayName,
        extension: extNoDot,
        mimeType,
        fileType,
        folderId: null,
        filePath: relOriginal,
        importSource: `orphan-repair:${id}`,
        fileSize: stat.size,
        hasThumbnail: false,
        thumbnailPath: null,
        metadata: null,
        fileCreatedAt: stat.birthtime,
        fileModifiedAt: stat.mtime,
        importedAt: now,
        updatedAt: now
      })

      const row = await database.select().from(assets).where(eq(assets.id, id)).get()
      if (row) {
        writeAssetSidecarMeta(row, [], [])
        if (fileType === '3d' && isModel3dPreviewExtension(extNoDot) && !isModelThumbnailSkipped(id)) {
          void schedule3dThumbnailAfterImport(database, id, origAbs, extNoDot)
        }
      }
      repaired++
      console.log(`[Library] Repaired orphan item pack: ${id}`)
    } catch (e) {
      console.error(`[Library] Failed to repair orphan item ${id}:`, e)
    }
  }

  if (repaired > 0) {
    persistDatabase()
    console.log(`[Library] Repaired ${repaired} orphan item pack(s)`)
  }

  return repaired
}
