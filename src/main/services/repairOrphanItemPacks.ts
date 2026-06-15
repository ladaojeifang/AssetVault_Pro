import { existsSync, readdirSync, statSync } from 'fs'
import { join, basename, extname } from 'path'
import { eq } from 'drizzle-orm'
import mime from 'mime-types'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import { getLibraryRoot, itemPackFileRelative, ITEMS_DIR } from './libraryBundle'
import { getFileType } from '../utils/fileUtils'
import { systemTypeCategoryId } from '@/shared/assetTypeRegistry'
import { resolveFormatCapabilities } from '@/shared/formatCapabilities'
import { finalizeAssetRecords } from './assetSearchIndex'
import { scheduleDeferredThumbnailAfterImport } from './thumbnailJobs'
import { isModelThumbnailSkipped } from './modelThumbnailSkip'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function scheduleRepairThumbnails(
  database: ReturnType<typeof getDatabase>,
  id: string,
  origAbs: string,
  extNoDot: string,
  hasThumbnail: boolean
): void {
  const caps = resolveFormatCapabilities(extNoDot)
  if (!caps.asyncThumbnail || hasThumbnail) return
  if (caps.asyncThumbnail === 'model3d' && isModelThumbnailSkipped(id)) return
  scheduleDeferredThumbnailAfterImport(database, id, origAbs, extNoDot)
}

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
      await finalizeAssetRecords(database, id)
      scheduleRepairThumbnails(database, id, origAbs, extNoDot, existing.hasThumbnail)
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
        typeId: systemTypeCategoryId(fileType),
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
        await finalizeAssetRecords(database, id)
        scheduleRepairThumbnails(database, id, origAbs, extNoDot, false)
      }
      repaired++
      console.log(`[Library] Repaired orphan item pack: ${id}`)
    } catch (e) {
      console.error(`[Library] Failed to repair orphan item ${id}:`, e)
    }
  }

  if (repaired > 0) {
    console.log(`[Library] Repaired ${repaired} orphan item pack(s)`)
  }

  return repaired
}
