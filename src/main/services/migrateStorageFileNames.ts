import { existsSync, renameSync, writeFileSync } from 'fs'
import { join, basename, sep } from 'path'
import { eq } from 'drizzle-orm'
import { getDatabase, persistDatabase } from '../db'
import { assets } from '../db/schema'
import {
  getLibraryRoot,
  resolveLibraryPath,
  itemPackFileRelative,
  sanitizeStorageFileName
} from './libraryBundle'
import { syncAssetSidecarFromDb } from './assetSidecar'

const FLAG = '.storage-display-filename-v1.done'

/**
 * One-time: rename items/{id}/original.ext → items/{id}/{originalName} for existing libraries.
 */
export async function migrateOriginalExtToDisplayFilenames(): Promise<void> {
  const libraryRoot = getLibraryRoot()
  const flagPath = join(libraryRoot, FLAG)
  if (existsSync(flagPath)) return

  const database = getDatabase()
  const all = await database.select().from(assets).all()
  let renamed = 0

  for (const row of all) {
    const currentBase = basename(row.filePath.split('/').join(sep))
    if (!currentBase.toLowerCase().startsWith('original.')) continue

    const targetName = sanitizeStorageFileName(row.originalName || row.filename)
    if (targetName.toLowerCase() === currentBase.toLowerCase()) continue

    const abs = resolveLibraryPath(row.filePath)
    const newRel = itemPackFileRelative(row.id, targetName)
    const newAbs = resolveLibraryPath(newRel)

    if (!existsSync(abs)) continue
    if (existsSync(newAbs)) {
      console.warn(`[Library] Skip rename (target exists): ${newAbs}`)
      continue
    }

    try {
      renameSync(abs, newAbs)
      await database
        .update(assets)
        .set({ filePath: newRel, updatedAt: new Date() })
        .where(eq(assets.id, row.id))
      await syncAssetSidecarFromDb(database, row.id)
      renamed++
    } catch (e) {
      console.error(`[Library] Could not rename asset file ${row.id}:`, e)
    }
  }

  writeFileSync(flagPath, new Date().toISOString(), 'utf-8')
  if (renamed > 0) {
    console.log(`[Library] Renamed ${renamed} on-disk asset file(s) to original display names`)
    persistDatabase()
  }
}
