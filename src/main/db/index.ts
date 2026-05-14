import initSqlJs from 'sql.js'
import { drizzle } from 'drizzle-orm/sql-js'
import { join } from 'path'
import { readFile, writeFile, rename } from 'fs/promises'
import { app } from 'electron'
import * as schema from './schema'

let db: ReturnType<typeof drizzle> | null = null
let SQLjsDb: initSqlJs.Database | null = null
const DB_FILENAME = 'assetvault.db'

/** True after mutations until a successful saveDatabase(). */
let dbDirty = false

/** Dev-only: electron-vite often kills the process on Windows without graceful quit, so debounced persist may never run. */
let devAutosaveInterval: ReturnType<typeof setInterval> | null = null

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Persist the in-memory SQLite database to disk.
 * Call this after important write operations or on app close.
 */
export async function saveDatabase(): Promise<void> {
  if (!SQLjsDb) return

  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, DB_FILENAME)
  const data = SQLjsDb.export()
  const buffer = Buffer.from(data)
  await writeFile(dbPath, buffer)
  dbDirty = false
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
const PERSIST_DEBOUNCE_MS = 120

/**
 * Debounced disk persist for sql.js — coalesces rapid writes.
 */
export function persistDatabase(): void {
  dbDirty = true
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void saveDatabase().catch((e) => console.error('[DB] persist failed:', e))
  }, PERSIST_DEBOUNCE_MS)
}

/**
 * Flush any pending debounced persist and write DB to disk immediately.
 */
export async function flushDatabase(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await saveDatabase()
}

/**
 * Stop the dev-only periodic autosave timer (optional; process exit also clears it).
 */
export function stopDevAutosave(): void {
  if (devAutosaveInterval) {
    clearInterval(devAutosaveInterval)
    devAutosaveInterval = null
  }
}

/**
 * Initialize database with sql.js (pure WASM SQLite).
 * Loads existing DB from disk or creates a new one with full schema.
 */
export async function initDatabase(): Promise<void> {
  if (db) return

  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, DB_FILENAME)

  console.log(`[DB] Initializing sql.js database at: ${dbPath}`)

  // Initialize sql.js WASM engine
  const SQL = await initSqlJs()

  let isFreshDb = false
  let fileBuffer: Buffer | undefined
  try {
    fileBuffer = await readFile(dbPath)
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined
    if (code !== 'ENOENT') {
      console.error('[DB] Failed to read database file:', err)
      throw err
    }
  }

  if (fileBuffer && fileBuffer.length > 0) {
    try {
      SQLjsDb = new SQL.Database(fileBuffer)
      console.log('[DB] Loaded existing database from disk')
    } catch (openErr) {
      console.error('[DB] File exists but is not a valid SQLite DB; keeping a backup copy:', openErr)
      const corruptPath = `${dbPath}.corrupt-${Date.now()}`
      try {
        await rename(dbPath, corruptPath)
        console.error(`[DB] Renamed unreadable DB to: ${corruptPath}`)
      } catch (renameErr) {
        console.error('[DB] Could not rename corrupt DB file:', renameErr)
      }
      SQLjsDb = new SQL.Database()
      isFreshDb = true
      console.log('[DB] Created new database after replacing corrupt file')
    }
  } else {
    SQLjsDb = new SQL.Database()
    isFreshDb = true
    console.log('[DB] Created new database (first run or empty DB file)')
  }

  // Performance pragmas (sql.js supports these)
  SQLjsDb.run('PRAGMA journal_mode = WAL;')
  SQLjsDb.run('PRAGMA synchronous = NORMAL;')
  SQLjsDb.run('PRAGMA cache_size = -64000;') // 64MB
  SQLjsDb.run('PRAGMA foreign_keys = ON;')
  SQLjsDb.run('PRAGMA temp_store = MEMORY;')

  // Create drizzle instance wrapping the raw Database
  db = drizzle(SQLjsDb, { schema })

  // Run schema creation (idempotent — all CREATE IF NOT EXISTS)
  createInitialSchema(SQLjsDb)

  // Save initial state to disk if this is a fresh DB
  if (isFreshDb) {
    await saveDatabase()
  }

  // electron-vite rebuilds kill the main process on Windows without running app quit hooks;
  // periodic flush limits data loss to ~this interval when dev workflow kills the process.
  if (!app.isPackaged) {
    if (devAutosaveInterval) clearInterval(devAutosaveInterval)
    devAutosaveInterval = setInterval(() => {
      if (!dbDirty || !SQLjsDb) return
      void flushDatabase().catch((e) => console.error('[DB] dev autosave failed:', e))
    }, 2000)
    console.log('[DB] Dev autosave every 2s when there are pending changes (survives abrupt process kill)')
  }

  console.log('[DB] Database initialized successfully')
}

function createInitialSchema(sqlite: initSqlJs.Database): void {
  // Folders table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      path TEXT NOT NULL UNIQUE,
      level INTEGER NOT NULL DEFAULT 0,
      asset_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Assets table
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

  // Tags table
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

  // Asset-Tags junction
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS asset_tags (
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY(asset_id, tag_id)
    )
  `)

  /*
   * FTS5 替代方案：使用普通表存储搜索索引 + LIKE 查询
   * 原因：标准 sql.js (WASM) 不包含 FTS5 模块
   * 对于本地桌面应用的数据规模，LIKE + 索引性能足够
   */
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS assets_search (
      asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
      search_text TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // Indexes for performance
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_folder_id ON assets(folder_id);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_file_type ON assets(file_type);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_imported_at ON assets(imported_at DESC);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_dominant_color ON assets(dominant_color);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_asset_tags_tag_id ON asset_tags(tag_id);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_id ON asset_tags(asset_id);`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_assets_search_text ON assets_search(search_text);`)

  // Triggers: keep assets_search table in sync with assets
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

  // Trigger to update tag usage count
  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS tr_tag_usage_insert AFTER INSERT ON asset_tags BEGIN
      UPDATE tags SET usage_count = usage_count + 1 WHERE id = new.tag_id;
    END;

    CREATE TRIGGER IF NOT EXISTS tr_tag_usage_delete AFTER DELETE ON asset_tags BEGIN
      UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE id = old.tag_id;
    END;
  `)

  // Trigger to update folder asset count
  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS tr_folder_asset_insert AFTER INSERT ON assets WHEN new.folder_id IS NOT NULL BEGIN
      UPDATE folders SET asset_count = asset_count + 1, updated_at = unixepoch()
      WHERE id = new.folder_id;
    END;

    CREATE TRIGGER IF NOT EXISTS tr_folder_asset_delete AFTER DELETE ON assets WHEN old.folder_id IS NOT NULL BEGIN
      UPDATE folders SET asset_count = MAX(0, asset_count - 1), updated_at = unixepoch()
      WHERE id = old.folder_id;
    END;
  `)

  console.log('[DB] Schema created/verified successfully')
}

export { db }
export * from './schema'
