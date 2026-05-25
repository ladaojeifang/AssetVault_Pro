import type initSqlJs from 'sql.js'

/** Idempotent schema setup for a raw sql.js database (new library or migration). */
export function createInitialSchemaOnSqlite(sqlite: initSqlJs.Database): void {
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
      INSERT INTO assets_search(asset_id, search_text)
      VALUES (new.id, new.filename || ' ' || new.original_name);
    END;

    CREATE TRIGGER IF NOT EXISTS tr_assets_search_delete AFTER DELETE ON assets BEGIN
      DELETE FROM assets_search WHERE asset_id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS tr_assets_search_update AFTER UPDATE ON assets BEGIN
      DELETE FROM assets_search WHERE asset_id = old.id;
      INSERT INTO assets_search(asset_id, search_text)
      VALUES (new.id, new.filename || ' ' || new.original_name ||
        COALESCE((SELECT ' ' || GROUP_CONCAT(t.name) FROM tags t JOIN asset_tags at ON t.id = at.tag_id WHERE at.asset_id = new.id), '')
      );
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

  console.log('[DB] Schema created/verified successfully')
}
