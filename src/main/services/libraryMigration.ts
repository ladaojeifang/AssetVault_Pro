import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs'
import { join, isAbsolute, sep } from 'path'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import {
  getLibraryRoot,
  itemPackFileRelative,
  itemThumbRelative,
  sanitizeStorageFileName
} from './libraryBundle'
import { writeAssetSidecarMeta } from './assetSidecar'
import { getLibraryMode } from './libraryManifest'

const MIGRATION_FLAG = '.bundle-migration-v1.done'

/**
 * One-time migration: copy assets referenced by absolute paths into items/{id}/ and rewrite DB paths.
 */
export async function runLegacyPathsMigrationIfNeeded(): Promise<void> {
  const libraryRoot = getLibraryRoot()
  const flagPath = join(libraryRoot, MIGRATION_FLAG)
  if (existsSync(flagPath)) return

  if (getLibraryMode() === 'catalog') {
    writeFileSync(
      flagPath,
      `${new Date().toISOString()}\ncatalog library — index mode keeps absolute file_path; skip bundle migration.\n`,
      'utf-8'
    )
    console.log('[Library] Skipping legacy path migration for catalog (index) library')
    return
  }

  const database = getDatabase()
  const all = await database.select().from(assets).all()
  const toMigrate = all.filter((a) => isAbsolute(a.filePath.trim()))

  if (toMigrate.length === 0) {
    if (!existsSync(flagPath)) {
      writeFileSync(flagPath, new Date().toISOString(), 'utf-8')
    }
    return
  }

  console.log(`[Library] Legacy path migration: ${toMigrate.length} asset(s)`)

  for (const row of toMigrate) {
    try {
      const src = row.filePath
      if (!existsSync(src)) {
        console.warn(`[Library] Skip missing file for asset ${row.id}: ${src}`)
        continue
      }

      const ext = row.extension.replace(/^\./, '').toLowerCase()
      const itemDir = join(libraryRoot, 'items', row.id)
      mkdirSync(itemDir, { recursive: true })

      const relOriginal = itemPackFileRelative(row.id, sanitizeStorageFileName(row.originalName || row.filename))
      const destOriginal = join(libraryRoot, relOriginal.split('/').join(sep))
      copyFileSync(src, destOriginal)

      let thumbPathDb: string | null = row.thumbnailPath ?? null
      let hasThumb = row.hasThumbnail

      if (row.thumbnailPath && existsSync(row.thumbnailPath)) {
        const relT = itemThumbRelative(row.id)
        const destT = join(libraryRoot, relT.split('/').join(sep))
        copyFileSync(row.thumbnailPath, destT)
        thumbPathDb = relT
        hasThumb = true
      } else {
        thumbPathDb = null
        hasThumb = false
      }

      await database
        .update(assets)
        .set({
          filePath: relOriginal,
          thumbnailPath: thumbPathDb,
          hasThumbnail: hasThumb,
          updatedAt: new Date()
        })
        .where(eq(assets.id, row.id))

      const updated = await database.select().from(assets).where(eq(assets.id, row.id)).get()
      if (updated) {
        writeAssetSidecarMeta(updated, [], [])
      }
    } catch (e) {
      console.error(`[Library] Migration failed for asset ${row.id}:`, e)
    }
  }

  writeFileSync(flagPath, new Date().toISOString(), 'utf-8')
  console.log('[Library] Legacy path migration finished; flag written:', flagPath)
}
