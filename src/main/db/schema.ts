import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * Folders table - 閫昏緫鍒嗙被鏍戯紙闈炵鐩樼洰褰曪級锛屾渶澶?5 灞傦紙level 0鈥?锛? */
export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  parentId: text('parent_id'), // null for root
  path: text('path').notNull().unique(),
  level: integer('level').notNull().default(0), // 宓屽灞傜骇 0-4
  assetCount: integer('asset_count').notNull().default(0),
  /** Accent color for sidebar (hex) */
  color: text('color').default('#64748b'),
  /** Optional emoji / short icon label */
  icon: text('icon'),
  /** Manual folder cover from asset thumbnail */
  coverAssetId: text('cover_asset_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

/**
 * Assets table - 鏍稿績璧勪骇琛? * 瀛樺偍鎵€鏈夊鍏ユ枃浠剁殑鍏冩暟鎹拰寮曠敤
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
  /** local = file under items/{id}/; referenced = absolute path to external file (catalog libraries). */
  storageMode: text('storage_mode').notNull().default('local'),
  localizationState: text('localization_state').notNull().default('idle'),
  sourceMissingAt: integer('source_missing_at', { mode: 'timestamp' }),
  /** Canonical absolute path of the file at import time; dedupes re-import of same source. */
  importSource: text('import_source'),
  fileSize: integer('file_size').notNull(), // bytes

  /** SHA-256 hex digest of file bytes (content-addressable dedup) */
  contentHash: text('content_hash'),
  contentHashComputedAt: integer('content_hash_computed_at', { mode: 'timestamp' }),

  // Dimensions
  width: integer('width'), // pixels (for image/video)
  height: integer('height'),

  // Color data (for images)
  dominantColor: text('dominant_color'), // hex #RRGGBB
  /** red|orange|yellow|green|cyan|blue|purple|pink|neutral 鈥?for filter bar */
  colorBucket: text('color_bucket'),
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

  /** User-assigned external source URL (shown in detail panel, openable in browser) */
  sourceUrl: text('source_url'),

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
 * Tags table - 鏍囩瀹氫箟
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
 * Asset-Tags junction table - 澶氬澶氬叧绯? */
export const assetTags = sqliteTable('asset_tags', {
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  tagId: text('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
  assignedAt: integer('assigned_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

/** 璧勪骇 鈫?閫昏緫鏂囦欢澶?澶氬澶?*/
export const assetFolders = sqliteTable(
  'asset_folders',
  {
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    folderId: text('folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    assignedAt: integer('assigned_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.assetId, t.folderId] })
  })
)

/*
 * Search index table (FTS5 鏇夸唬鏂规)
 * 浣跨敤鏅€氳〃 + LIKE 鎼滅储锛團TS5 鍙綔涓哄悗缁寮猴級
 * 瀵逛簬鏈湴妗岄潰搴旂敤鐨勬暟鎹妯★紝鎬ц兘瀹屽叏瓒冲
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
export type AssetFolder = typeof assetFolders.$inferSelect
export type AssetSearch = typeof assetsSearch.$inferSelect
