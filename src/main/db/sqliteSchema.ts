import type { RawSqliteDb } from './rawSqlite'

const SCHEMA_META_KEY = 'schema_version'

/**
 * Monotonic library DB schema revision. Bump when adding a new branch in
 * `runLibrarySchemaMigrations` ??do not edit old steps in place.
 */
export const CURRENT_LIBRARY_SCHEMA_VERSION = 5

/** Current persisted schema version, or 0 if meta table / row missing. */
export function getLibrarySchemaVersion(sqlite: RawSqliteDb): number {
  const v = sqlite.getScalarInt(
    `SELECT value FROM _av_schema_meta WHERE key = '${SCHEMA_META_KEY}' LIMIT 1`
  )
  return v != null && v >= 0 ? Math.floor(v) : 0
}

export function setLibrarySchemaVersion(sqlite: RawSqliteDb, version: number): void {
  const v = Math.max(0, Math.floor(version))
  sqlite.run(
    `INSERT OR REPLACE INTO _av_schema_meta (key, value) VALUES ('${SCHEMA_META_KEY}', ${v})`
  )
}

/**
 * Run forward-only migrations after `CREATE TABLE` / best-effort ALTERs above.
 * New columns: add `if (v < N) { ?? set(N) }` ??never change past N in place.
 */
export function runLibrarySchemaMigrations(sqlite: RawSqliteDb): void {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS _av_schema_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value INTEGER NOT NULL
    )
  `)

  let v = getLibrarySchemaVersion(sqlite)

  if (v < 1) {
    // v1 marker only: column DDL for storage_mode / localization / source_missing
    // still runs via try/catch ALTER in createInitialSchemaOnSqlite (legacy path).
    v = 1
    setLibrarySchemaVersion(sqlite, v)
  }

  if (v < 2) {
    // v2 marker only: no ALTER here yet. Next real migration ??add `if (v < 3) { ??}`.
    v = 2
    setLibrarySchemaVersion(sqlite, v)
  }

  if (v < 3) {
    sqlite.run(`
      UPDATE assets SET storage_mode = 'referenced'
      WHERE (storage_mode IS NULL OR trim(storage_mode) = '' OR storage_mode = 'local')
        AND length(trim(file_path)) >= 2
        AND substr(trim(file_path), 2, 1) = ':'
    `)
    sqlite.run(`
      UPDATE assets SET storage_mode = 'local'
      WHERE storage_mode IS NULL OR trim(storage_mode) = ''
    `)
    v = 3
    setLibrarySchemaVersion(sqlite, v)
  }

  if (v < 4) {
    sqlite.run(`DROP TRIGGER IF EXISTS tr_assets_search_update`)
    sqlite.run(`DROP TRIGGER IF EXISTS tr_asset_tags_search_insert`)
    sqlite.run(`DROP TRIGGER IF EXISTS tr_asset_tags_search_delete`)
    v = 4
    setLibrarySchemaVersion(sqlite, v)
  }

  if (v < 5) {
    // v5: add source_url column for external web link
    // No data migration needed — new column defaults to NULL
    v = 5
    setLibrarySchemaVersion(sqlite, v)
  }

  const stamped = getLibrarySchemaVersion(sqlite)
  if (stamped !== CURRENT_LIBRARY_SCHEMA_VERSION) {
    console.warn(
      `[DB] schema meta version=${stamped} but CURRENT_LIBRARY_SCHEMA_VERSION=${CURRENT_LIBRARY_SCHEMA_VERSION} ??add a migration branch or fix the constant`
    )
  }
}

/** Idempotent schema setup for a raw SQLite connection (new library or migration). */
export function createInitialSchemaOnSqlite(sqlite: RawSqliteDb): void {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      path TEXT NOT NULL UNIQUE,
      level INTEGER NOT NULL DEFAULT 0,
      asset_count INTEGER NOT NULL DEFAULT 0,
      color TEXT DEFAULT '#64748b',
      icon TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  try {
    sqlite.run(`ALTER TABLE folders ADD COLUMN color TEXT DEFAULT '#64748b'`)
  } catch {
    /* column already exists */
  }
  try {
    sqlite.run(`ALTER TABLE folders ADD COLUMN icon TEXT`)
  } catch {
    /* column already exists */
  }
  try {
    sqlite.run(`ALTER TABLE folders ADD COLUMN cover_asset_id TEXT`)
  } catch {
    /* column already exists */
  }
  sqlite.run(`UPDATE folders SET color = '#64748b' WHERE color IS NULL OR trim(color) = ''`)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      extension TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_type TEXT NOT NULL,
      folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL UNIQUE,
      import_source TEXT,
      file_size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      dominant_color TEXT,
      colors TEXT,
      duration REAL,
      thumbnail_path TEXT,
      has_thumbnail INTEGER NOT NULL DEFAULT 0 CHECK(has_thumbnail IN (0, 1)),
      metadata TEXT,
      notes TEXT,
      view_count INTEGER NOT NULL DEFAULT 0,
      access_count INTEGER NOT NULL DEFAULT 0,
      file_created_at INTEGER,
      file_modified_at INTEGER,
      imported_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  try {
    sqlite.run('ALTER TABLE assets ADD COLUMN notes TEXT')
  } catch {
    /* column already exists */
  }

  try {
    sqlite.run('ALTER TABLE assets ADD COLUMN import_source TEXT')
  } catch {
    /* column already exists */
  }

  try {
    sqlite.run('ALTER TABLE assets ADD COLUMN content_hash TEXT')
  } catch {
    /* column already exists */
  }

  try {
    sqlite.run('ALTER TABLE assets ADD COLUMN content_hash_computed_at INTEGER')
  } catch {
    /* column already exists */
  }

  try {
    sqlite.run('ALTER TABLE assets ADD COLUMN color_bucket TEXT')
  } catch {
    /* column already exists */
  }

  try {
    sqlite.run(`ALTER TABLE assets ADD COLUMN storage_mode TEXT NOT NULL DEFAULT 'local'`)
  } catch {
    /* column already exists */
  }
  try {
    sqlite.run(`ALTER TABLE assets ADD COLUMN localization_state TEXT NOT NULL DEFAULT 'idle'`)
  } catch {
    /* column already exists */
  }
  try {
    sqlite.run('ALTER TABLE assets ADD COLUMN source_missing_at INTEGER')
  } catch {
    /* column already exists */
  }
  try {
    sqlite.run('ALTER TABLE assets ADD COLUMN source_url TEXT')
  } catch {
    /* column already exists */
  }
  sqlite.run(`
    UPDATE assets SET storage_mode = 'referenced'
    WHERE (storage_mode IS NULL OR trim(storage_mode) = '')
      AND length(trim(file_path)) >= 2
      AND substr(trim(file_path), 2, 1) = ':'
  `)
  sqlite.run(`UPDATE assets SET storage_mode = 'local' WHERE storage_mode IS NULL OR trim(storage_mode) = ''`)

  try {
    sqlite.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_import_source ON assets(import_source)')
  } catch {
    /* ignore */
  }

  sqlite.run(
    `CREATE INDEX IF NOT EXISTS idx_assets_size_hash ON assets(file_size, content_hash) WHERE content_hash IS NOT NULL`
  )

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS asset_folders (
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY(asset_id, folder_id)
    )
  `)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_asset_folders_asset_id ON asset_folders(asset_id)`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_asset_folders_folder_id ON asset_folders(folder_id)`)

  sqlite.run(`
    INSERT OR IGNORE INTO asset_folders (asset_id, folder_id, assigned_at)
    SELECT id, folder_id, unixepoch() FROM assets WHERE folder_id IS NOT NULL
  `)
  sqlite.run(`UPDATE assets SET folder_id = NULL WHERE folder_id IS NOT NULL`)

  sqlite.run(`DROP TRIGGER IF EXISTS tr_folder_asset_insert`)
  sqlite.run(`DROP TRIGGER IF EXISTS tr_folder_asset_delete`)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      description TEXT,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS asset_tags (
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY(asset_id, tag_id)
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS assets_search (
      asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
      search_text TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_folder_id ON assets(folder_id);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_file_type ON assets(file_type);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_imported_at ON assets(imported_at DESC);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_dominant_color ON assets(dominant_color);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_color_bucket ON assets(color_bucket);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_file_size ON assets(file_size);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_asset_tags_tag_id ON asset_tags(tag_id);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_id ON asset_tags(asset_id);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_search_text ON assets_search(search_text);`)

  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS tr_assets_search_insert AFTER INSERT ON assets BEGIN
      INSERT OR IGNORE INTO assets_search(asset_id, search_text)
      VALUES (new.id, new.filename || ' ' || new.original_name);
    END;

    CREATE TRIGGER IF NOT EXISTS tr_assets_search_delete AFTER DELETE ON assets BEGIN
      DELETE FROM assets_search WHERE asset_id = old.id;
    END;
  `)

  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS tr_tag_usage_insert AFTER INSERT ON asset_tags BEGIN
      UPDATE tags SET usage_count = usage_count + 1 WHERE id = new.tag_id;
    END;

    CREATE TRIGGER IF NOT EXISTS tr_tag_usage_delete AFTER DELETE ON asset_tags BEGIN
      UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE id = old.tag_id;
    END;
  `)

  runLibrarySchemaMigrations(sqlite)

  console.log('[DB] Schema created/verified successfully')
}
