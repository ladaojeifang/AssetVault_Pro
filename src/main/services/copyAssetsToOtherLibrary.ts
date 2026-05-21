import initSqlJs from 'sql.js'
import { cpSync, existsSync, mkdirSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join, basename, sep } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../db'
import { assets, assetTags, tags } from '../db/schema'
import {
  getLibraryRoot,
  LIBRARY_DB_NAME,
  ensureLibraryDirectories,
  itemThumbRelative
} from './libraryBundle'
import { writeAssetSidecarMeta } from './assetSidecar'
import { createInitialSchemaOnSqlite } from '../db/sqliteSchema'

export async function copyAssetsToOtherLibrary(
  assetIds: string[],
  targetLibraryRoot: string
): Promise<{ copied: number; skipped: number }> {
  const sourceRoot = getLibraryRoot()
  const targetRoot = targetLibraryRoot.trim()
  if (!targetRoot) throw new Error('目标资料库路径无效')
  if (targetRoot.toLowerCase() === sourceRoot.toLowerCase()) {
    throw new Error('不能复制到当前资料库')
  }

  ensureLibraryDirectories(targetRoot)
  const targetDbPath = join(targetRoot, LIBRARY_DB_NAME)

  const database = getDatabase()
  const SQL = await initSqlJs()
  let targetSql: initSqlJs.Database
  try {
    const buf = await readFile(targetDbPath)
    targetSql = new SQL.Database(buf)
  } catch {
    targetSql = new SQL.Database()
    createInitialSchemaOnSqlite(targetSql)
  }

  let copied = 0
  let skipped = 0

  for (const sourceId of assetIds) {
    const row = await database.select().from(assets).where(eq(assets.id, sourceId)).get()
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
    cpSync(srcDir, destDir, { recursive: true })

    const ext = row.extension.replace(/^\./, '').toLowerCase()
    const storageFileName = basename(row.filePath.split('/').join(sep))
    const filePath = `items/${newId}/${storageFileName}`
    const thumbRel = row.hasThumbnail && row.thumbnailPath ? itemThumbRelative(newId) : null
    const now = Math.floor(Date.now() / 1000)

    targetSql.run(
      `INSERT OR IGNORE INTO assets (
        id, filename, original_name, extension, mime_type, file_type, folder_id, file_path, import_source,
        file_size, content_hash, content_hash_computed_at, width, height, dominant_color, colors, duration, thumbnail_path, has_thumbnail,
        metadata, notes, view_count, access_count, file_created_at, file_modified_at, imported_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
      [
        newId,
        row.filename,
        row.originalName,
        ext,
        row.mimeType,
        row.fileType,
        filePath,
        row.fileSize,
        row.contentHash ?? null,
        row.contentHashComputedAt
          ? Math.floor(new Date(row.contentHashComputedAt).getTime() / 1000)
          : null,
        row.width ?? null,
        row.height ?? null,
        row.dominantColor ?? null,
        row.colors ?? null,
        row.duration ?? null,
        thumbRel,
        row.hasThumbnail ? 1 : 0,
        row.metadata ?? null,
        row.notes ?? null,
        row.fileCreatedAt ? Math.floor(new Date(row.fileCreatedAt).getTime() / 1000) : null,
        row.fileModifiedAt ? Math.floor(new Date(row.fileModifiedAt).getTime() / 1000) : null,
        now,
        now
      ]
    )

    const searchText = `${row.filename} ${row.originalName}`
    targetSql.run(`INSERT OR REPLACE INTO assets_search (asset_id, search_text) VALUES (?, ?)`, [
      newId,
      searchText
    ])

    const tagRows = await database
      .select({ id: tags.id, name: tags.name, tagId: assetTags.tagId })
      .from(assetTags)
      .innerJoin(tags, eq(assetTags.tagId, tags.id))
      .where(eq(assetTags.assetId, sourceId))
      .all()

    for (const t of tagRows) {
      targetSql.run(
        `INSERT OR IGNORE INTO asset_tags (asset_id, tag_id, assigned_at) VALUES (?, ?, ?)`,
        [newId, t.tagId, now]
      )
    }

    writeAssetSidecarMeta(
      {
        ...row,
        id: newId,
        filePath,
        thumbnailPath: thumbRel,
        folderId: null,
        importedAt: new Date(now * 1000),
        updatedAt: new Date(now * 1000)
      },
      tagRows.map((t) => ({ id: t.tagId, name: t.name })),
      [],
      targetRoot
    )

    copied++
  }

  const out = Buffer.from(targetSql.export())
  targetSql.close()
  await writeFile(targetDbPath, out)

  return { copied, skipped }
}
