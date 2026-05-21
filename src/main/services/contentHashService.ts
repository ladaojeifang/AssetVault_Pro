import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import type { DuplicateImportPromptPayload } from '@/shared/importTypes'
import { CONTENT_HASH_ALGO } from '@/shared/importTypes'
import { db, persistDatabase } from '../db'
import { assets, assetFolders, folders } from '../db/schema'
import { computeFileSha256 } from '../utils/contentHash'
import { resolveLibraryPath, getLibraryRoot } from './libraryBundle'
import { syncAssetSidecarFromDb } from './assetSidecar'

type Database = NonNullable<typeof db>

function readSidecarContentHash(assetId: string): string | null {
  const metaPath = join(getLibraryRoot(), 'items', assetId, 'meta.json')
  if (!existsSync(metaPath)) return null
  try {
    const raw = JSON.parse(readFileSync(metaPath, 'utf-8')) as {
      contentHash?: { algo?: string; value?: string }
    }
    if (raw.contentHash?.algo === CONTENT_HASH_ALGO && typeof raw.contentHash.value === 'string') {
      return raw.contentHash.value
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Resolve cached hash: DB → meta.json → compute from library file and persist. */
export async function ensureAssetContentHash(database: Database, assetId: string): Promise<string | null> {
  const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!row) return null

  if (row.contentHash) return row.contentHash

  const fromSidecar = readSidecarContentHash(assetId)
  if (fromSidecar) {
    await database
      .update(assets)
      .set({ contentHash: fromSidecar, contentHashComputedAt: new Date(), updatedAt: new Date() })
      .where(eq(assets.id, assetId))
    persistDatabase()
    return fromSidecar
  }

  const abs = resolveLibraryPath(row.filePath)
  if (!existsSync(abs)) return null

  const hash = await computeFileSha256(abs)
  await database
    .update(assets)
    .set({ contentHash: hash, contentHashComputedAt: new Date(), updatedAt: new Date() })
    .where(eq(assets.id, assetId))
  persistDatabase()
  await syncAssetSidecarFromDb(database, assetId)
  return hash
}

/** Find an existing asset with the same size + SHA-256 (backfills missing hashes for size matches). */
export async function findAssetIdByContentHash(
  database: Database,
  fileSize: number,
  contentHash: string
): Promise<string | null> {
  const candidates = await database.select().from(assets).where(eq(assets.fileSize, fileSize)).all()

  for (const candidate of candidates) {
    let hash = candidate.contentHash
    if (!hash) {
      hash = readSidecarContentHash(candidate.id)
      if (!hash) {
        const abs = resolveLibraryPath(candidate.filePath)
        if (!existsSync(abs)) continue
        hash = await computeFileSha256(abs)
      }
      await database
        .update(assets)
        .set({ contentHash: hash, contentHashComputedAt: new Date(), updatedAt: new Date() })
        .where(eq(assets.id, candidate.id))
      persistDatabase()
      await syncAssetSidecarFromDb(database, candidate.id)
    }
    if (hash === contentHash) return candidate.id
  }

  return null
}

export async function buildDuplicatePromptPayload(
  database: Database,
  existingId: string,
  sourcePath: string,
  contentHash: string,
  fileSize: number
): Promise<Omit<DuplicateImportPromptPayload, 'requestId'>> {
  const row = await database.select().from(assets).where(eq(assets.id, existingId)).get()
  if (!row) throw new Error('Duplicate asset row missing')

  const folderLinks = await database
    .select({ folderId: assetFolders.folderId })
    .from(assetFolders)
    .where(eq(assetFolders.assetId, existingId))
    .all()

  const folderNames: string[] = []
  for (const link of folderLinks) {
    const folder = await database.select().from(folders).where(eq(folders.id, link.folderId)).get()
    if (folder?.name) folderNames.push(folder.name)
  }

  const importedAt =
    row.importedAt instanceof Date ? row.importedAt.toISOString() : new Date().toISOString()

  return {
    sourcePath,
    sourceName: sourcePath.split(/[/\\]/).pop() ?? sourcePath,
    contentHash,
    fileSize,
    existing: {
      id: row.id,
      originalName: row.originalName,
      filename: row.filename,
      importedAt,
      folderNames
    }
  }
}

export async function scanLibraryContentHashes(
  onProgress?: (data: { current: number; total: number; assetId: string; status: 'processing' | 'done' | 'skipped' | 'error' }) => void
): Promise<{ scanned: number; updated: number; skipped: number; errors: number }> {
  const database = db!
  const rows = await database
    .select({
      id: assets.id,
      filePath: assets.filePath,
      fileSize: assets.fileSize,
      contentHash: assets.contentHash,
      contentHashComputedAt: assets.contentHashComputedAt
    })
    .from(assets)
    .all()

  let updated = 0
  let skipped = 0
  let errors = 0
  const total = rows.length

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    onProgress?.({ current: i + 1, total, assetId: row.id, status: 'processing' })

    const abs = resolveLibraryPath(row.filePath)
    if (!existsSync(abs)) {
      errors++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'error' })
      continue
    }

    let diskMtimeMs = 0
    let diskSize = row.fileSize
    try {
      const st = statSync(abs)
      diskMtimeMs = st.mtimeMs
      diskSize = st.size
    } catch {
      errors++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'error' })
      continue
    }

    const computedAtMs =
      row.contentHashComputedAt instanceof Date ? row.contentHashComputedAt.getTime() : 0

    const needsRecompute =
      !row.contentHash || diskSize !== row.fileSize || diskMtimeMs > computedAtMs + 500

    if (!needsRecompute) {
      skipped++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'skipped' })
      continue
    }

    try {
      const hash = await computeFileSha256(abs)
      await database
        .update(assets)
        .set({
          contentHash: hash,
          contentHashComputedAt: new Date(),
          fileSize: diskSize,
          updatedAt: new Date()
        })
        .where(eq(assets.id, row.id))
      await syncAssetSidecarFromDb(database, row.id)
      updated++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'done' })
    } catch {
      errors++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'error' })
    }
  }

  if (updated > 0) persistDatabase()

  return { scanned: total, updated, skipped, errors }
}
