import { randomUUID } from 'node:crypto'
import { existsSync } from 'fs'
import { eq, sql } from 'drizzle-orm'
import type { BrowserWindow } from 'electron'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import { getLibraryRoot } from './libraryBundle'
import { getLibraryMode, readLibraryManifestFile, writeLibraryManifest } from './libraryManifest'
import { localizeOneAsset } from './localizeAsset'
import type { UpgradeLibraryProgress } from '@/shared/libraryTypes'

export async function getLibraryModeStats(): Promise<import('@/shared/libraryTypes').LibraryModeStats> {
  const database = getDatabase()
  const mode = getLibraryMode()
  const referenced = await database
    .select({ count: sql<number>`count(*)` })
    .from(assets)
    .where(eq(assets.storageMode, 'referenced'))
    .get()
  const local = await database
    .select({ count: sql<number>`count(*)` })
    .from(assets)
    .where(eq(assets.storageMode, 'local'))
    .get()
  const pending = await database
    .select({ count: sql<number>`count(*)` })
    .from(assets)
    .where(eq(assets.localizationState, 'pending'))
    .get()

  const rows = await database
    .select()
    .from(assets)
    .where(eq(assets.storageMode, 'referenced'))
    .all()
  let missingSourceCount = 0
  const { resolveAssetContentPath } = await import('./assetPathResolver')
  for (const row of rows) {
    const abs = resolveAssetContentPath(row)
    if (!existsSync(abs)) missingSourceCount++
  }

  return {
    libraryMode: mode,
    referencedCount: Number(referenced?.count ?? 0),
    localCount: Number(local?.count ?? 0),
    missingSourceCount,
    pendingLocalizationCount: Number(pending?.count ?? 0)
  }
}

export async function upgradeCatalogLibraryToArchive(
  win: BrowserWindow | undefined,
  options?: { preferHardlink?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (getLibraryMode() !== 'catalog') {
    return { ok: false, error: '当前资料库已是完整库' }
  }

  const root = getLibraryRoot()
  const jobId = randomUUID()
  writeLibraryManifest(root, {
    libraryMode: 'catalog',
    localization: {
      state: 'running',
      startedAt: new Date().toISOString(),
      completedAt: null,
      lastJobId: jobId
    }
  })

  const database = getDatabase()
  const rows = await database.select().from(assets).where(eq(assets.storageMode, 'referenced')).all()
  const total = rows.length
  let errors = 0

  const send = (data: UpgradeLibraryProgress) => {
    try {
      win?.webContents.send('library:upgrade-progress', data)
    } catch {
      /* window gone */
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    send({ current: i + 1, total, filename: row.filename, status: 'processing' })
    const r = await localizeOneAsset(row.id, { preferHardlink: options?.preferHardlink ?? true })
    if (!r.ok) {
      errors++
      send({ current: i + 1, total, filename: row.filename, status: 'error' })
    } else {
      send({ current: i + 1, total, filename: row.filename, status: 'done' })
    }
  }

  writeLibraryManifest(root, {
    libraryMode: 'archive',
    localization: {
      state: errors > 0 ? 'completed_with_errors' : 'completed',
      startedAt: readLibraryManifestFile(root)?.localization?.startedAt ?? null,
      completedAt: new Date().toISOString(),
      lastJobId: jobId
    }
  })

  return { ok: true }
}

export async function relinkAssetSource(assetId: string, newSourcePath: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { toCanonicalFilePath } = await import('../utils/pathUtils')
  const database = getDatabase()
  const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!row) return { ok: false, error: '资产不存在' }
  if ((row.storageMode ?? 'local') !== 'referenced') {
    return { ok: false, error: '仅索引库引用资产可重新链接' }
  }

  const canonical = toCanonicalFilePath(newSourcePath)
  if (!existsSync(canonical)) return { ok: false, error: '路径不存在' }

  await database
    .update(assets)
    .set({
      filePath: canonical,
      importSource: canonical,
      sourceMissingAt: null,
      updatedAt: new Date()
    })
    .where(eq(assets.id, assetId))

  const { syncAssetSidecarFromDb } = await import('./assetSidecar')
  await syncAssetSidecarFromDb(database, assetId)
  return { ok: true }
}

export async function verifyReferencedSources(): Promise<{ checked: number; missing: number }> {
  const database = getDatabase()
  const rows = await database.select().from(assets).where(eq(assets.storageMode, 'referenced')).all()
  const { resolveAssetContentPath } = await import('./assetPathResolver')
  let missing = 0
  for (const row of rows) {
    const abs = resolveAssetContentPath(row)
    const isMissing = !existsSync(abs)
    if (isMissing) missing++
    await database
      .update(assets)
      .set({
        sourceMissingAt: isMissing ? new Date() : null,
        updatedAt: new Date()
      })
      .where(eq(assets.id, row.id))
  }
  return { checked: rows.length, missing }
}
