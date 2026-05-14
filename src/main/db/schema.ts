import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * Folders table - 文件夹树形结构
 * 支持无限层级嵌套（实际限制5层）
 */
export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  parentId: text('parent_id'), // null for root
  path: text('path').notNull().unique(),
  level: integer('level').notNull().default(0), // 嵌套层级 0-4
  assetCount: integer('asset_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

/**
 * Assets table - 核心资产表
 * 存储所有导入文件的元数据和引用
 */
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(), // UUID
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  extension: text('extension').notNull(),
  mimeType: text('mime_type').notNull(),
  fileType: text('file_type').notNull(), // image|video|audio|font|design|document|3d|code|other
  folderId: text('folder_id').references(() => folders.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull().unique(),
  fileSize: integer('file_size').notNull(), // bytes

  // Dimensions
  width: integer('width'), // pixels (for image/video)
  height: integer('height'),

  // Color data (for images)
  dominantColor: text('dominant_color'), // hex #RRGGBB
  colors: text('colors'), // JSON array of top colors

  // Duration (for video/audio)
  duration: real('duration'), // seconds

  // Thumbnail
  thumbnailPath: text('thumbnail_path'),
  hasThumbnail: integer('has_thumbnail', { mode: 'boolean' }).notNull().default(false),

  // Metadata JSON
  metadata: text('metadata'), // EXIF/IPTC/ID3/etc as JSON

  /** User-editable remarks (shown in detail panel) */
  notes: text('notes'),

  // Stats
  viewCount: integer('view_count').notNull().default(0),
  accessCount: integer('access_count').notNull().default(0),

  // Timestamps
  fileCreatedAt: integer('file_created_at', { mode: 'timestamp' }),
  fileModifiedAt: integer('file_modified_at', { mode: 'timestamp' }),
  importedAt: integer('imported_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

/**
 * Tags table - 标签定义
 */
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#3B82F6'),
  description: text('description'),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

/**
 * Asset-Tags junction table - 多对多关系
 */
export const assetTags = sqliteTable('asset_tags', {
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
  assignedAt: integer('assigned_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

/*
 * Search index table (FTS5 替代方案)
 * 标准 sql.js WASM 不包含 FTS5 模块，使用普通表 + LIKE 搜索
 * 对于本地桌面应用的数据规模，性能完全足够
 */
export const assetsSearch = sqliteTable('assets_search', {
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  searchText: text('search_text').notNull(), // Concatenated searchable text
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

// Type exports
export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert
export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
export type AssetTag = typeof assetTags.$inferSelect
export type AssetSearch = typeof assetsSearch.$inferSelect
