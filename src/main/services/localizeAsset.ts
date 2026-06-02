import { existsSync, mkdirSync, readdirSync, cpSync } from 'fs'
import { basename, extname, join, sep } from 'path'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import {
  getLibraryRoot,
  itemPackFileRelative,
  sanitizeStorageFileName
} from './libraryBundle'
import { getLibraryMode } from './libraryManifest'
import { resolveAssetContentPath } from './assetPathResolver'
import { copyOrHardlinkIntoLibrary } from './fileCopyIntoLibrary'
import { syncAssetSidecarFromDb } from './assetSidecar'
import { copyObjCompanionMtlForImport } from './importSingleAssetHelpers'

function posixRelToFsAbs(libraryRoot: string, rel: string): string {
  return join(libraryRoot, rel.split('/').join(sep))
}

/** Localize using an explicit source file/pack (e.g. catalog import L2 from A items pack). */
export async function localizeAssetFromSource(
  assetId: string,
  sourceAbs: string,
  options?: { preferHardlink?: boolean; sourcePackDir?: string }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const database = getDatabase()
  const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!row) return { ok: false, reason: '资产不存在' }

  if (!existsSync(sourceAbs)) {
    return { ok: false, reason: '源文件不存在' }
  }

  const libraryRoot = getLibraryRoot()
  const storageFileName = sanitizeStorageFileName(basename(sourceAbs) || row.originalName || row.filename)
  const relOriginal = itemPackFileRelative(assetId, storageFileName)
  const destAbs = posixRelToFsAbs(libraryRoot, relOriginal)
  const itemDirAbs = join(libraryRoot, 'items', assetId)
  mkdirSync(itemDirAbs, { recursive: true })

  await database
    .update(assets)
    .set({ localizationState: 'pending', updatedAt: new Date() })
    .where(eq(assets.id, assetId))

  const preferHardlink = options?.preferHardlink ?? getLibraryMode() === 'archive'

  try {
    const packDir = options?.sourcePackDir
    if (packDir && existsSync(packDir)) {
      for (const ent of readdirSync(packDir, { withFileTypes: true })) {
        if (!ent.isFile()) continue
        cpSync(join(packDir, ent.name), join(itemDirAbs, ent.name), { force: true })
      }
      if (!existsSync(destAbs)) {
        copyOrHardlinkIntoLibrary(sourceAbs, destAbs, preferHardlink)
      }
    } else {
      copyOrHardlinkIntoLibrary(sourceAbs, destAbs, preferHardlink)
    }

    const extNoDot = extname(sourceAbs).replace(/^\./, '').toLowerCase()
    if (extNoDot === 'obj') {
      copyObjCompanionMtlForImport(sourceAbs, itemDirAbs)
    }
  } catch (e) {
    await database
      .update(assets)
      .set({ localizationState: 'failed', updatedAt: new Date() })
      .where(eq(assets.id, assetId))
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }

  await database
    .update(assets)
    .set({
      filePath: relOriginal,
      storageMode: 'local',
      localizationState: 'done',
      sourceMissingAt: null,
      updatedAt: new Date()
    })
    .where(eq(assets.id, assetId))

  await syncAssetSidecarFromDb(database, assetId)
  return { ok: true }
}

export async function localizeOneAsset(
  assetId: string,
  options?: { preferHardlink?: boolean }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const database = getDatabase()
  const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!row) return { ok: false, reason: '资产不存在' }
  if ((row.storageMode ?? 'local') === 'local') return { ok: true }

  const sourceAbs = resolveAssetContentPath(row)
  if (!existsSync(sourceAbs)) {
    await database
      .update(assets)
      .set({
        localizationState: 'failed',
        sourceMissingAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(assets.id, assetId))
    return { ok: false, reason: '源文件不存在' }
  }

  const libraryRoot = getLibraryRoot()
  const storageFileName = sanitizeStorageFileName(row.originalName || row.filename)
  const relOriginal = itemPackFileRelative(assetId, storageFileName)
  const destAbs = posixRelToFsAbs(libraryRoot, relOriginal)
  const itemDirAbs = join(libraryRoot, 'items', assetId)
  mkdirSync(itemDirAbs, { recursive: true })

  await database
    .update(assets)
    .set({ localizationState: 'pending', updatedAt: new Date() })
    .where(eq(assets.id, assetId))

  try {
    copyOrHardlinkIntoLibrary(sourceAbs, destAbs, options?.preferHardlink ?? getLibraryMode() === 'archive')
    const extNoDot = extname(sourceAbs).replace(/^\./, '').toLowerCase()
    if (extNoDot === 'obj') {
      copyObjCompanionMtlForImport(sourceAbs, itemDirAbs)
    }
  } catch (e) {
    await database
      .update(assets)
      .set({ localizationState: 'failed', updatedAt: new Date() })
      .where(eq(assets.id, assetId))
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }

  await database
    .update(assets)
    .set({
      filePath: relOriginal,
      storageMode: 'local',
      localizationState: 'done',
      sourceMissingAt: null,
      updatedAt: new Date()
    })
    .where(eq(assets.id, assetId))

  await syncAssetSidecarFromDb(database, assetId)
  return { ok: true }
}

export async function localizeAssets(
  assetIds: string[],
  options?: { preferHardlink?: boolean }
): Promise<import('@/shared/libraryTypes').LocalizeAssetsResult> {
  const result: import('@/shared/libraryTypes').LocalizeAssetsResult = {
    localized: 0,
    skipped: 0,
    failed: 0,
    errors: []
  }

  for (const id of assetIds) {
    const row = await getDatabase().select().from(assets).where(eq(assets.id, id)).get()
    if (!row) {
      result.failed++
      result.errors.push({ assetId: id, filename: id, reason: '不存在' })
      continue
    }
    if ((row.storageMode ?? 'local') === 'local') {
      result.skipped++
      continue
    }
    const r = await localizeOneAsset(id, options)
    if (r.ok) result.localized++
    else {
      result.failed++
      result.errors.push({ assetId: id, filename: row.filename, reason: r.reason })
    }
  }

  return result
}
