import { existsSync, renameSync } from 'fs'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../db'
import { assets, assetsSearch } from '../db/schema'
import { syncAssetSidecarFromDb } from './assetSidecar'
import {
  itemPackFileRelative,
  resolveLibraryPath,
  sanitizeStorageFileName
} from './libraryBundle'

function sanitizeBaseName(raw: string): string {
  const trimmed = raw.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
  return trimmed || 'Untitled'
}

/**
 * Rename asset display name, on-disk file under items/{id}/, and metadata.
 */
export async function renameAsset(assetId: string, newNameInput: string): Promise<{ filename: string }> {
  const database = getDatabase()
  const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!row) throw new Error('资产不存在')

  const ext = row.extension.replace(/^\./, '').toLowerCase()
  let base = sanitizeBaseName(newNameInput)
  if (base.toLowerCase().endsWith(`.${ext}`)) {
    base = base.slice(0, -(ext.length + 1))
  }
  const filename = `${base}.${ext}`
  const originalName = sanitizeStorageFileName(filename)
  const newRel = itemPackFileRelative(assetId, originalName)
  const oldAbs = resolveLibraryPath(row.filePath)
  const newAbs = resolveLibraryPath(newRel)

  if (oldAbs !== newAbs && existsSync(oldAbs)) {
    if (existsSync(newAbs)) {
      throw new Error('资料库目录下已存在同名文件')
    }
    renameSync(oldAbs, newAbs)
  }

  await database
    .update(assets)
    .set({
      filename,
      originalName,
      filePath: newRel,
      updatedAt: new Date()
    })
    .where(eq(assets.id, assetId))

  const searchRow = await database
    .select({ assetId: assetsSearch.assetId })
    .from(assetsSearch)
    .where(eq(assetsSearch.assetId, assetId))
    .get()

  const searchText = `${base} ${originalName}`
  if (searchRow) {
    await database
      .update(assetsSearch)
      .set({ searchText })
      .where(eq(assetsSearch.assetId, assetId))
  } else {
    await database.insert(assetsSearch).values({ assetId, searchText })
  }

  await syncAssetSidecarFromDb(database, assetId)
  return { filename }
}
