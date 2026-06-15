import type { SqliteDatabase } from '../db/sqliteTypes'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'fs'
import { basename, join, normalize, sep, isAbsolute } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { BrowserWindow } from 'electron'
import { and, countDistinct, desc, eq } from 'drizzle-orm'
import { getDatabase } from '../db'
import { openBetterSqliteDatabase } from '../db/betterSqliteNative'
import { resolveImportedTypeId } from '@/shared/assetTypeRegistry'
import { assets, assetFolders, assetTags, categories, folders, tags } from '../db/schema'
import { getLibraryRoot, ITEMS_DIR, LIBRARY_DB_NAME } from './libraryBundle'
import { readLibraryManifestFile, readLibraryDisplayName } from './libraryManifest'
import { syncAssetSidecarFromDb, writeAssetSidecarMeta } from './assetSidecar'
import { finalizeAssetRecords } from './assetSearchIndex'
import { CONTENT_HASH_ALGO } from '@/shared/importTypes'
import type { ImportLibraryProgress, ImportLibrarySuccess } from '@/shared/libraryTypes'

export type ProgressFn = (p: ImportLibraryProgress) => void

export type SourceTagRow = {
  id: string
  name: string
  color: string
  description: string | null
}

export type SourceFolderRow = {
  id: string
  name: string
  parent_id: string | null
  path: string
  level: number
  color: string | null
  icon: string | null
}

export type SourceAssetRow = {
  id: string
  filename: string
  original_name: string
  extension: string
  mime_type: string
  file_type: string
  folder_id: string | null
  file_path: string
  storage_mode: string
  import_source: string | null
  file_size: number
  content_hash: string | null
  content_hash_computed_at: number | null
  width: number | null
  height: number | null
  dominant_color: string | null
  colors: string | null
  duration: number | null
  thumbnail_path: string | null
  has_thumbnail: number
  metadata: string | null
  notes: string | null
  source_url: string | null
  is_favorite: number
  file_created_at: number | null
  file_modified_at: number | null
  imported_at: number
  updated_at: number
  type_id?: string | null
}

export type SourceCategoryRow = {
  id: string
  name: string
  color: string
  icon: string | null
  description: string | null
  sort_order: number
}

export type BaseImportStats = {
  foldersCreated: number
  foldersMerged: number
  tagsCreated: number
  tagsMerged: number
  categoriesCreated: number
  categoriesMerged: number
  assetsAdded: number
  assetsSkippedDuplicate: number
  assetsFailed: number
  errors: ImportLibrarySuccess['errors']
}

export function normalizeLibraryRoot(p: string): string {
  return normalize(p.trim())
}

export function readSourceDisplayName(sourceRoot: string): string {
  return readLibraryDisplayName(sourceRoot)
}

export function tsToDate(sec: number | null | undefined): Date | null {
  if (sec == null || !Number.isFinite(sec)) return null
  return new Date(sec * 1000)
}

export function emitImportProgress(
  onProgress: ProgressFn | undefined,
  win: BrowserWindow | undefined,
  data: ImportLibraryProgress
) {
  onProgress?.(data)
  if (!win) return
  try {
    if (win.isDestroyed()) return
    win.webContents.send('library:import-progress', data)
  } catch (err) {
    if (!win.isDestroyed()) {
      console.error(`[importLibrary] Failed to send progress:`, err)
    }
  }
}

export function readSourceSidecarContentHash(sourceRoot: string, assetId: string): string | null {
  const metaPath = join(sourceRoot, ITEMS_DIR, assetId, 'meta.json')
  if (!existsSync(metaPath)) return null
  try {
    const raw = JSON.parse(readFileSync(metaPath, 'utf-8')) as {
      contentHash?: { algo?: string; value?: string }
    }
    if (
      raw.contentHash?.algo === CONTENT_HASH_ALGO &&
      typeof raw.contentHash?.value === 'string'
    ) {
      return raw.contentHash.value
    }
  } catch {
    /* ignore */
  }
  return null
}

export function resolveSourceContentAbs(sourceRoot: string, row: SourceAssetRow): string | null {
  const fp = row.file_path?.trim() ?? ''
  if (fp) {
    const abs = isAbsolute(fp) ? normalize(fp) : join(sourceRoot, fp.split('/').join(sep))
    if (existsSync(abs) && statSync(abs).isFile()) return abs
  }

  const itemDir = join(sourceRoot, ITEMS_DIR, row.id)
  if (!existsSync(itemDir)) return null

  if (fp) {
    const fromBase = join(itemDir, basename(fp.split('/').join(sep)))
    if (existsSync(fromBase) && statSync(fromBase).isFile()) return fromBase
  }

  try {
    const entries = readdirSync(itemDir, { withFileTypes: true })
    let best: { path: string; size: number } | null = null
    for (const ent of entries) {
      if (!ent.isFile()) continue
      if (ent.name === 'meta.json' || ent.name.startsWith('thumb.')) continue
      const full = join(itemDir, ent.name)
      const size = statSync(full).size
      if (!best || size > best.size) best = { path: full, size }
    }
    return best?.path ?? null
  } catch {
    return null
  }
}

export function sourceAssetPackDir(sourceRoot: string, assetId: string): string {
  return join(sourceRoot, ITEMS_DIR, assetId)
}

export function isLocalizedInSource(sourceRoot: string, row: SourceAssetRow): boolean {
  if ((row.storage_mode ?? 'local') !== 'local') return false
  const contentAbs = resolveSourceContentAbs(sourceRoot, row)
  if (!contentAbs) return false
  const rootNorm = normalize(sourceRoot).toLowerCase()
  return normalize(contentAbs).toLowerCase().startsWith(rootNorm)
}

export function classifySourceAsset(
  sourceRoot: string,
  row: SourceAssetRow
): 'L' | 'R' | 'M' {
  const contentAbs = resolveSourceContentAbs(sourceRoot, row)
  if (!contentAbs) return 'M'
  if (isLocalizedInSource(sourceRoot, row)) return 'L'
  return 'R'
}

export function rewriteItemRelativePath(rel: string, oldId: string, newId: string): string {
  const posix = rel.replace(/\\/g, '/')
  if (posix.includes(`items/${oldId}/`)) {
    return posix.replace(`items/${oldId}/`, `items/${newId}/`)
  }
  if (posix.startsWith(`items/${oldId}`)) {
    return posix.replace(`items/${oldId}`, `items/${newId}`)
  }
  const name = basename(posix)
  return `items/${newId}/${name}`
}

export function openSourceLibraryDb(sourceDbPath: string): SqliteDatabase {
  return openBetterSqliteDatabase(sourceDbPath, { readonly: true, fileMustExist: true })
}

export function readSourceLibraryMode(sourceRoot: string): import('@/shared/libraryTypes').LibraryMode | null {
  return readLibraryManifestFile(sourceRoot)?.libraryMode ?? null
}

export function assertValidLibraryRoot(sourceRootRaw: string):
  | { ok: false; error: string; code: 'SOURCE_NOT_FOUND' | 'INVALID_PATH' | 'SAME_LIBRARY' }
  | { ok: true; sourceRoot: string; sourceDbPath: string } {
  const sourceRoot = normalizeLibraryRoot(sourceRootRaw)
  if (!sourceRoot || !existsSync(sourceRoot)) {
    return { ok: false, error: '源资料库路径不存在', code: 'SOURCE_NOT_FOUND' }
  }

  try {
    if (!statSync(sourceRoot).isDirectory()) {
      return { ok: false, error: '源路径不是文件夹', code: 'INVALID_PATH' }
    }
  } catch {
    return { ok: false, error: '无法访问源资料库路径', code: 'SOURCE_NOT_FOUND' }
  }

  const manifestPath = join(sourceRoot, 'manifest.json')
  const sourceDbPath = join(sourceRoot, LIBRARY_DB_NAME)
  if (!existsSync(manifestPath) || !existsSync(sourceDbPath)) {
    return { ok: false, error: '所选目录不是有效的 AssetVault 资料库', code: 'INVALID_PATH' }
  }

  const targetRoot = getLibraryRoot()
  if (sourceRoot.toLowerCase() === targetRoot.toLowerCase()) {
    return { ok: false, error: '源资料库与当前资料库相同', code: 'SAME_LIBRARY' }
  }

  return { ok: true as const, sourceRoot, sourceDbPath }
}

export async function ensureSourceLibraryTag(
  targetDb: ReturnType<typeof getDatabase>,
  tagName: string
): Promise<{ id: string; created: boolean }> {
  const existing = await targetDb.select().from(tags).where(eq(tags.name, tagName)).get()
  if (existing) return { id: existing.id, created: false }
  const id = uuidv4()
  await targetDb.insert(tags).values({
    id,
    name: tagName,
    color: '#64748b',
    description: `Imported from library "${tagName}"`
  } as any)
  return { id, created: true }
}

export async function phaseTags(
  sourceDb: SqliteDatabase,
  targetDb: ReturnType<typeof getDatabase>,
  sourceLibraryTagName: string,
  stats: BaseImportStats
): Promise<{ tagMap: Map<string, string>; sourceLibraryTagId: string }> {
  const tagMap = new Map<string, string>()
  const sourceTags = sourceDb.prepare('SELECT id, name, color, description FROM tags').all() as SourceTagRow[]

  for (const st of sourceTags) {
    const name = st.name?.trim()
    if (!name) continue
    const existing = await targetDb.select().from(tags).where(eq(tags.name, name)).get()
    if (existing) {
      tagMap.set(st.id, existing.id)
      stats.tagsMerged++
    } else {
      const id = uuidv4()
      await targetDb.insert(tags).values({
        id,
        name,
        color: st.color || '#3B82F6',
        description: st.description
      } as any)
      tagMap.set(st.id, id)
      stats.tagsCreated++
    }
  }

  const sourceHadLibraryTag = sourceTags.some((t) => t.name?.trim() === sourceLibraryTagName)
  const { id: sourceLibraryTagId, created: sourceLibraryTagCreated } = await ensureSourceLibraryTag(
    targetDb,
    sourceLibraryTagName
  )
  for (const st of sourceTags) {
    if (st.name?.trim() === sourceLibraryTagName) {
      tagMap.set(st.id, sourceLibraryTagId)
    }
  }
  if (!sourceHadLibraryTag) {
    if (sourceLibraryTagCreated) stats.tagsCreated++
    else stats.tagsMerged++
  }

  return { tagMap, sourceLibraryTagId }
}

export async function mapOrCreateTargetCategory(
  targetDb: ReturnType<typeof getDatabase>,
  name: string,
  color: string,
  icon: string | null,
  description: string | null,
  sortOrder: number,
  stats?: Pick<BaseImportStats, 'categoriesCreated' | 'categoriesMerged'>
): Promise<string> {
  const trimmed = name.trim()
  const existing = await targetDb.select().from(categories).where(eq(categories.name, trimmed)).get()
  if (existing) {
    stats && stats.categoriesMerged++
    return existing.id
  }

  const last = await targetDb
    .select({ sortOrder: categories.sortOrder })
    .from(categories)
    .orderBy(desc(categories.sortOrder))
    .limit(1)
    .get()
  const nextSort = sortOrder >= 0 ? sortOrder : (last?.sortOrder ?? -1) + 1

  const id = uuidv4()
  await targetDb.insert(categories).values({
    id,
    name: trimmed,
    color: color || '#FF9F1C',
    icon,
    description,
    sortOrder: nextSort
  } as any)
  stats && stats.categoriesCreated++
  return id
}

export function readSourceCategories(sourceDb: SqliteDatabase): SourceCategoryRow[] {
  try {
    return sourceDb
      .prepare(
        'SELECT id, name, color, icon, description, sort_order FROM categories ORDER BY sort_order ASC'
      )
      .all() as SourceCategoryRow[]
  } catch {
    return []
  }
}

export async function phaseCategories(
  sourceDb: SqliteDatabase,
  targetDb: ReturnType<typeof getDatabase>,
  stats: BaseImportStats
): Promise<Map<string, string>> {
  const categoryMap = new Map<string, string>()
  const sourceCategories = readSourceCategories(sourceDb)

  for (const sc of sourceCategories) {
    const name = sc.name?.trim()
    if (!name) continue
    const targetId = await mapOrCreateTargetCategory(
      targetDb,
      name,
      sc.color,
      sc.icon,
      sc.description,
      sc.sort_order ?? 0,
      stats
    )
    categoryMap.set(sc.id, targetId)
  }

  return categoryMap
}

export async function phaseFolders(
  sourceDb: SqliteDatabase,
  targetDb: ReturnType<typeof getDatabase>,
  stats: BaseImportStats
): Promise<Map<string, string>> {
  const folderMap = new Map<string, string>()
  const sourceFolders = sourceDb
    .prepare('SELECT id, name, parent_id, path, level, color, icon FROM folders ORDER BY level ASC')
    .all() as SourceFolderRow[]

  for (const sf of sourceFolders) {
    const path = sf.path?.trim()
    if (!path) continue

    const existing = await targetDb.select().from(folders).where(eq(folders.path, path)).get()
    if (existing) {
      folderMap.set(sf.id, existing.id)
      stats.foldersMerged++
      continue
    }

    const parentTargetId = sf.parent_id ? folderMap.get(sf.parent_id) ?? null : null
    const id = uuidv4()
    await targetDb.insert(folders).values({
      id,
      name: sf.name,
      parentId: parentTargetId,
      path,
      level: sf.level,
      color: sf.color ?? '#64748b',
      icon: sf.icon
    } as any)
    folderMap.set(sf.id, id)
    stats.foldersCreated++
  }

  return folderMap
}

export async function assignTag(targetDb: ReturnType<typeof getDatabase>, assetId: string, tagId: string) {
  const existing = await targetDb
    .select()
    .from(assetTags)
    .where(and(eq(assetTags.assetId, assetId), eq(assetTags.tagId, tagId)))
    .get()
  if (!existing) {
    await targetDb.insert(assetTags).values({ assetId, tagId })
  }
}

export async function assignFolder(targetDb: ReturnType<typeof getDatabase>, assetId: string, folderId: string) {
  const existing = await targetDb
    .select()
    .from(assetFolders)
    .where(and(eq(assetFolders.assetId, assetId), eq(assetFolders.folderId, folderId)))
    .get()
  if (!existing) {
    await targetDb.insert(assetFolders).values({ assetId, folderId })
  }
}

export async function applySourceTagsAndLibraryTag(
  targetDb: ReturnType<typeof getDatabase>,
  assetId: string,
  sourceAssetId: string,
  sourceDb: SqliteDatabase,
  tagMap: Map<string, string>,
  sourceLibraryTagId: string
) {
  const sourceTagLinks = sourceDb
    .prepare('SELECT tag_id FROM asset_tags WHERE asset_id = ?')
    .all(sourceAssetId) as Array<{ tag_id: string }>
  for (const link of sourceTagLinks) {
    const mapped = tagMap.get(link.tag_id)
    if (mapped) await assignTag(targetDb, assetId, mapped)
  }
  await assignTag(targetDb, assetId, sourceLibraryTagId)
  await finalizeAssetRecords(targetDb, assetId)
}

export async function applySourceFolders(
  targetDb: ReturnType<typeof getDatabase>,
  assetId: string,
  sourceRow: SourceAssetRow,
  folderMap: Map<string, string>,
  sourceDb: SqliteDatabase
) {
  const sourceFolderLinks = sourceDb
    .prepare('SELECT folder_id FROM asset_folders WHERE asset_id = ?')
    .all(sourceRow.id) as Array<{ folder_id: string }>
  for (const link of sourceFolderLinks) {
    const mapped = folderMap.get(link.folder_id)
    if (mapped) await assignFolder(targetDb, assetId, mapped)
  }
  if (sourceRow.folder_id) {
    const mapped = folderMap.get(sourceRow.folder_id)
    if (mapped) await assignFolder(targetDb, assetId, mapped)
  }
}

export async function mergeAssetMetadata(
  targetDb: ReturnType<typeof getDatabase>,
  targetAssetId: string,
  sourceRow: SourceAssetRow,
  folderMap: Map<string, string>,
  tagMap: Map<string, string>,
  sourceLibraryTagId: string,
  sourceDb: SqliteDatabase
) {
  const targetRow = await targetDb.select().from(assets).where(eq(assets.id, targetAssetId)).get()
  if (!targetRow) return

  if (!targetRow.notes?.trim() && sourceRow.notes?.trim()) {
    await targetDb
      .update(assets)
      .set({ notes: sourceRow.notes.trim(), updatedAt: new Date() })
      .where(eq(assets.id, targetAssetId))
  }

  if (!targetRow.sourceUrl?.trim() && sourceRow.source_url?.trim()) {
    await targetDb
      .update(assets)
      .set({ sourceUrl: sourceRow.source_url.trim(), updatedAt: new Date() })
      .where(eq(assets.id, targetAssetId))
  }

  if (sourceRow.is_favorite && !targetRow.isFavorite) {
    await targetDb
      .update(assets)
      .set({ isFavorite: true, updatedAt: new Date() })
      .where(eq(assets.id, targetAssetId))
  }

  await applySourceFolders(targetDb, targetAssetId, sourceRow, folderMap, sourceDb)
  await applySourceTagsAndLibraryTag(
    targetDb,
    targetAssetId,
    sourceRow.id,
    sourceDb,
    tagMap,
    sourceLibraryTagId
  )
}

export async function insertLocalAssetFromSourcePack(
  targetDb: ReturnType<typeof getDatabase>,
  targetRoot: string,
  sourceRoot: string,
  sourceRow: SourceAssetRow,
  contentHash: string,
  contentAbs: string,
  categoryMap: Map<string, string> = new Map(),
  sourceDb?: SqliteDatabase
): Promise<string> {
  const newId = uuidv4()
  const srcItemDir = join(sourceRoot, ITEMS_DIR, sourceRow.id)
  const destItemDir = join(targetRoot, ITEMS_DIR, newId)
  mkdirSync(join(targetRoot, ITEMS_DIR), { recursive: true })
  cpSync(srcItemDir, destItemDir, { recursive: true })

  const filePath = rewriteItemRelativePath(sourceRow.file_path, sourceRow.id, newId)
  const thumbPath = sourceRow.thumbnail_path
    ? rewriteItemRelativePath(sourceRow.thumbnail_path, sourceRow.id, newId)
    : null
  const now = new Date()
  const ext = sourceRow.extension.replace(/^\./, '').toLowerCase()

  const rawTypeId = sourceDb ? resolveSourceAssetTypeId(sourceDb, sourceRow) : sourceRow.type_id
  const typeId = resolveImportedTypeId(rawTypeId, sourceRow.file_type, categoryMap)

  try {
    await targetDb.insert(assets).values({
    id: newId,
    filename: sourceRow.filename,
    originalName: sourceRow.original_name,
    extension: ext,
    mimeType: sourceRow.mime_type,
    fileType: sourceRow.file_type,
    typeId,
    folderId: null,
    filePath,
    storageMode: 'local',
    localizationState: 'idle',
    importSource: normalize(contentAbs),
    fileSize: sourceRow.file_size,
    contentHash,
    contentHashComputedAt: tsToDate(sourceRow.content_hash_computed_at) ?? now,
    width: sourceRow.width,
    height: sourceRow.height,
    dominantColor: sourceRow.dominant_color,
    colors: sourceRow.colors,
    duration: sourceRow.duration,
    thumbnailPath: thumbPath,
    hasThumbnail: Boolean(sourceRow.has_thumbnail),
    metadata: sourceRow.metadata,
    notes: sourceRow.notes,
    sourceUrl: sourceRow.source_url,
    isFavorite: Boolean(sourceRow.is_favorite),
    fileCreatedAt: tsToDate(sourceRow.file_created_at),
    fileModifiedAt: tsToDate(sourceRow.file_modified_at),
    importedAt: now,
    updatedAt: now
  } as any)
  } catch (e) {
    try {
      rmSync(destItemDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    throw e
  }

  const row = await targetDb.select().from(assets).where(eq(assets.id, newId)).get()
  if (row) writeAssetSidecarMeta(row, [], [])

  return newId
}

export async function refreshFolderAssetCounts(targetDb: ReturnType<typeof getDatabase>) {
  const countRows = await targetDb
    .select({
      folderId: assetFolders.folderId,
      c: countDistinct(assetFolders.assetId)
    })
    .from(assetFolders)
    .groupBy(assetFolders.folderId)
    .all()

  const countMap = new Map<string, number>()
  for (const row of countRows) {
    if (row.folderId) countMap.set(row.folderId, Number(row.c ?? 0))
  }

  const allFolders = await targetDb.select({ id: folders.id }).from(folders).all()
  for (const f of allFolders) {
    await targetDb
      .update(folders)
      .set({ assetCount: countMap.get(f.id) ?? 0, updatedAt: new Date() })
      .where(eq(folders.id, f.id))
  }
}

export function resolveSourceAssetTypeId(sourceDb: SqliteDatabase, row: SourceAssetRow): string {
  if (row.type_id?.trim()) return row.type_id.trim()
  try {
    const link = sourceDb
      .prepare(
        `SELECT ac.category_id FROM asset_categories ac
         INNER JOIN categories c ON c.id = ac.category_id
         WHERE ac.asset_id = ?
         ORDER BY c.sort_order ASC, ac.assigned_at ASC
         LIMIT 1`
      )
      .get(row.id) as { category_id: string } | undefined
    if (link?.category_id) return link.category_id
  } catch {
    /* legacy source without asset_categories */
  }
  return resolveImportedTypeId(null, row.file_type, new Map())
}

export function loadSourceAssets(sourceDb: SqliteDatabase): SourceAssetRow[] {
  const hasTypeId = (
    sourceDb
      .prepare(`SELECT COUNT(*) as c FROM pragma_table_info('assets') WHERE name = 'type_id'`)
      .get() as { c: number }
  ).c > 0
  const typeSelect = hasTypeId ? 'type_id' : `NULL AS type_id`
  return sourceDb
    .prepare(
      `SELECT id, filename, original_name, extension, mime_type, file_type, ${typeSelect}, folder_id, file_path,
        storage_mode, import_source, file_size, content_hash, content_hash_computed_at, width, height,
        dominant_color, colors, duration, thumbnail_path, has_thumbnail, metadata, notes, source_url, is_favorite,
        file_created_at, file_modified_at, imported_at, updated_at
       FROM assets ORDER BY imported_at ASC`
    )
    .all() as SourceAssetRow[]
}

export async function isTargetAssetLocalInLibrary(
  targetDb: ReturnType<typeof getDatabase>,
  assetId: string,
  libraryRoot: string
): Promise<boolean> {
  const row = await targetDb.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!row) return false
  const mode = row.storageMode ?? (isAbsolute(row.filePath.trim()) ? 'referenced' : 'local')
  if (mode !== 'local') return false
  const fp = row.filePath.trim()
  if (isAbsolute(fp)) {
    return normalize(fp).toLowerCase().startsWith(normalize(libraryRoot).toLowerCase())
  }
  return fp.replace(/\\/g, '/').startsWith('items/')
}
