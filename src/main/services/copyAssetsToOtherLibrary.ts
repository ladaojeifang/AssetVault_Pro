import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'fs'
import { join, basename, sep } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getDatabase } from '../db'
import { openBetterSqliteDatabase } from '../db/betterSqliteNative'
import { assets, assetFolders, assetTags, categories, folders, tags } from '../db/schema'
import { createInitialSchemaOnSqlite } from '../db/sqliteSchema'
import { wrapBetterSqlite } from '../db/rawSqlite'
import {
  getLibraryRoot,
  LIBRARY_DB_NAME,
  ensureLibraryDirectories,
  itemThumbRelative
} from './libraryBundle'
import { finalizeAssetRecords } from './assetSearchIndex'
import { writeAssetSidecarMeta } from './assetSidecar'
import { mapSourceTypeIdToTarget } from './categoryService'
import * as schema from '../db/schema'

async function ensureTargetTag(
  targetDb: ReturnType<typeof drizzle<typeof schema>>,
  name: string,
  color: string,
  description: string | null
): Promise<string> {
  const existing = await targetDb.select().from(tags).where(eq(tags.name, name)).get()
  if (existing) return existing.id
  const id = uuidv4()
  await targetDb.insert(tags).values({
    id,
    name,
    color: color || '#3B82F6',
    description
  } as any)
  return id
}

async function ensureTargetFolderByPath(
  targetDb: ReturnType<typeof drizzle<typeof schema>>,
  sourceDb: ReturnType<typeof getDatabase>,
  sourceFolderId: string,
  folderCache: Map<string, string>
): Promise<string | null> {
  if (folderCache.has(sourceFolderId)) return folderCache.get(sourceFolderId)!
  const srcFolder = await sourceDb.select().from(folders).where(eq(folders.id, sourceFolderId)).get()
  if (!srcFolder) return null

  let parentTargetId: string | null = null
  if (srcFolder.parentId) {
    parentTargetId = await ensureTargetFolderByPath(targetDb, sourceDb, srcFolder.parentId, folderCache)
  }

  const existing = await targetDb.select().from(folders).where(eq(folders.path, srcFolder.path)).get()
  if (existing) {
    folderCache.set(sourceFolderId, existing.id)
    return existing.id
  }

  const id = uuidv4()
  await targetDb.insert(folders).values({
    id,
    name: srcFolder.name,
    parentId: parentTargetId,
    path: srcFolder.path,
    level: srcFolder.level,
    color: srcFolder.color ?? '#64748b',
    icon: srcFolder.icon
  } as any)
  folderCache.set(sourceFolderId, id)
  return id
}

export async function copyAssetsToOtherLibrary(
  assetIds: string[],
  targetLibraryRoot: string
): Promise<{ copied: number; skipped: number }> {
  const sourceRoot = getLibraryRoot()
  const targetRoot = targetLibraryRoot.trim()
  if (!targetRoot) throw new Error('Invalid target library path')
  if (targetRoot.toLowerCase() === sourceRoot.toLowerCase()) {
    throw new Error('Cannot copy into the active library')
  }

  ensureLibraryDirectories(targetRoot)
  const targetDbPath = join(targetRoot, LIBRARY_DB_NAME)

  const sourceDb = getDatabase()
  const needsSchema = !existsSync(targetDbPath) || statSync(targetDbPath).size === 0
  const targetRaw = openBetterSqliteDatabase(targetDbPath)
  try {
    targetRaw.pragma('journal_mode = WAL')
    targetRaw.pragma('foreign_keys = ON')
    targetRaw.pragma('busy_timeout = 5000')
    if (needsSchema) {
      createInitialSchemaOnSqlite(wrapBetterSqlite(targetRaw))
    }

    const targetDb = drizzle(targetRaw, { schema })
    const folderCache = new Map<string, string>()

    let copied = 0
    let skipped = 0

    for (const sourceId of assetIds) {
      const row = await sourceDb.select().from(assets).where(eq(assets.id, sourceId)).get()
      if (!row) {
        skipped++
        continue
      }

      const srcDir = join(sourceRoot, 'items', sourceId)
      if (!existsSync(srcDir)) {
        skipped++
        continue
      }

      const newId = uuidv4()
      const destDir = join(targetRoot, 'items', newId)
      mkdirSync(join(targetRoot, 'items'), { recursive: true })

      try {
        cpSync(srcDir, destDir, { recursive: true })

        const ext = row.extension.replace(/^\./, '').toLowerCase()
        const storageFileName = basename(row.filePath.split('/').join(sep))
        const filePath = `items/${newId}/${storageFileName}`
        const thumbRel = row.hasThumbnail && row.thumbnailPath ? itemThumbRelative(newId) : null
        const now = new Date()

        const mappedTypeId = await mapSourceTypeIdToTarget(
          targetDb,
          sourceDb,
          row.typeId,
          row.fileType
        )

        await targetDb.insert(assets).values({
          id: newId,
          filename: row.filename,
          originalName: row.originalName,
          extension: ext,
          mimeType: row.mimeType,
          fileType: row.fileType,
          typeId: mappedTypeId,
          folderId: null,
          filePath,
          storageMode: row.storageMode ?? 'local',
          localizationState: row.localizationState ?? 'idle',
          sourceMissingAt: null,
          importSource: row.importSource,
          fileSize: row.fileSize,
          contentHash: row.contentHash,
          contentHashComputedAt: row.contentHashComputedAt,
          width: row.width,
          height: row.height,
          dominantColor: row.dominantColor,
          colorBucket: row.colorBucket,
          colors: row.colors,
          duration: row.duration,
          thumbnailPath: thumbRel,
          hasThumbnail: row.hasThumbnail,
          metadata: row.metadata,
          notes: row.notes,
          sourceUrl: row.sourceUrl,
          isFavorite: row.isFavorite ?? false,
          fileCreatedAt: row.fileCreatedAt,
          fileModifiedAt: row.fileModifiedAt,
          importedAt: now,
          updatedAt: now
        } as any)

        const tagRows = await sourceDb
          .select({ id: tags.id, name: tags.name, color: tags.color, description: tags.description })
          .from(assetTags)
          .innerJoin(tags, eq(assetTags.tagId, tags.id))
          .where(eq(assetTags.assetId, sourceId))
          .all()

        const assignedTags: Array<{ id: string; name: string }> = []
        for (const t of tagRows) {
          const targetTagId = await ensureTargetTag(targetDb, t.name, t.color, t.description)
          const existingLink = await targetDb
            .select()
            .from(assetTags)
            .where(and(eq(assetTags.assetId, newId), eq(assetTags.tagId, targetTagId)))
            .get()
          if (!existingLink) {
            await targetDb.insert(assetTags).values({ assetId: newId, tagId: targetTagId })
          }
          assignedTags.push({ id: targetTagId, name: t.name })
        }

        const sourceFolderLinks = await sourceDb
          .select({ folderId: assetFolders.folderId })
          .from(assetFolders)
          .where(eq(assetFolders.assetId, sourceId))
          .all()

        const assignedFolderIds: string[] = []
        for (const link of sourceFolderLinks) {
          const mapped = await ensureTargetFolderByPath(targetDb, sourceDb, link.folderId, folderCache)
          if (!mapped) continue
          assignedFolderIds.push(mapped)
          const existingLink = await targetDb
            .select()
            .from(assetFolders)
            .where(and(eq(assetFolders.assetId, newId), eq(assetFolders.folderId, mapped)))
            .get()
          if (!existingLink) {
            await targetDb.insert(assetFolders).values({ assetId: newId, folderId: mapped })
          }
        }

        if (row.folderId) {
          const mapped = await ensureTargetFolderByPath(targetDb, sourceDb, row.folderId, folderCache)
          if (mapped && !assignedFolderIds.includes(mapped)) {
            await targetDb.insert(assetFolders).values({ assetId: newId, folderId: mapped })
          }
        }

        await finalizeAssetRecords(targetDb, newId)

        const inserted = await targetDb.select().from(assets).where(eq(assets.id, newId)).get()
        if (inserted) {
          const folderMeta = await targetDb
            .select({ id: folders.id, name: folders.name })
            .from(assetFolders)
            .innerJoin(folders, eq(assetFolders.folderId, folders.id))
            .where(eq(assetFolders.assetId, newId))
            .all()
          const typeRow = mappedTypeId.startsWith('__sys:')
            ? { id: mappedTypeId, name: mappedTypeId.slice('__sys:'.length) }
            : await targetDb
                .select({ id: categories.id, name: categories.name })
                .from(categories)
                .where(eq(categories.id, mappedTypeId))
                .get()
          writeAssetSidecarMeta(
            inserted,
            assignedTags,
            folderMeta.map((f) => f.id),
            targetRoot,
            typeRow ? { id: typeRow.id, name: typeRow.name } : null
          )
        }

        copied++
      } catch (e) {
        try {
          rmSync(destDir, { recursive: true, force: true })
        } catch {
          /* ignore */
        }
        console.error('[copyAssetsToOtherLibrary] failed for', sourceId, e)
        skipped++
      }
    }

    targetRaw.pragma('wal_checkpoint(TRUNCATE)')
    return { copied, skipped }
  } finally {
    targetRaw.close()
  }
}
