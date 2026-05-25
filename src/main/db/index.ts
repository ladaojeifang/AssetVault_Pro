import initSqlJs from 'sql.js'
import { drizzle } from 'drizzle-orm/sql-js'
import { join, dirname, normalize } from 'path'
import { readFile, writeFile, rename, mkdir, unlink } from 'fs/promises'
import { randomBytes } from 'node:crypto'
import { app } from 'electron'
import * as schema from './schema'
import { createInitialSchemaOnSqlite } from './sqliteSchema'
import { backfillColorBuckets } from '../services/backfillColorBuckets'

let db: ReturnType<typeof drizzle> | null = null
let SQLjsDb: initSqlJs.Database | null = null
/** Absolute path to the active library.sqlite (set in initDatabase). */
let activeDbFilePath: string | null = null

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

/** Serialize disk writes — overlapping saves used the same *.tmp path and broke rename on Windows (ENOENT). */
let saveTail: Promise<void> = Promise.resolve()

async function writeDbAtomic(dbPath: string, buffer: Buffer): Promise<void> {
  await mkdir(dirname(dbPath), { recursive: true })
  const tmp = `${dbPath}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`
  try {
    await writeFile(tmp, buffer)
    await rename(tmp, dbPath)
  } catch (e) {
    await unlink(tmp).catch(() => {})
    throw e
  }
}

/**
 * Persist the in-memory SQLite database to disk.
 * Call this after important write operations or on app close.
 */
export async function saveDatabase(): Promise<void> {
  if (!SQLjsDb || !activeDbFilePath) return

  const p = saveTail.then(async () => {
    if (!SQLjsDb || !activeDbFilePath) return
    const dbPath = activeDbFilePath
    const buffer = Buffer.from(SQLjsDb.export())
    await writeDbAtomic(dbPath, buffer)
    dbDirty = false
  })
  saveTail = p.catch(() => {})
  return p
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
 * Close the in-memory DB and release sql.js (e.g. before switching library root).
 */
export async function closeDatabase(): Promise<void> {
  stopDevAutosave()
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await saveTail.catch(() => {})
  if (SQLjsDb && activeDbFilePath) {
    try {
      const p = activeDbFilePath
      const buffer = Buffer.from(SQLjsDb.export())
      await writeDbAtomic(p, buffer)
    } catch (e) {
      console.error('[DB] closeDatabase flush failed:', e)
    }
  }
  dbDirty = false
  db = null
  if (SQLjsDb) {
    try {
      SQLjsDb.close()
    } catch {
      /* ignore */
    }
    SQLjsDb = null
  }
  activeDbFilePath = null
  saveTail = Promise.resolve()
}

/**
 * Initialize database with sql.js (pure WASM SQLite).
 * Loads existing DB from disk or creates a new one with full schema.
 * @param dbPath Absolute path to library.sqlite inside the library root.
 */
export async function initDatabase(dbPath: string): Promise<void> {
  const normalized = normalize(dbPath)
  if (db && activeDbFilePath && normalize(activeDbFilePath) === normalized) {
    return
  }
  if (db) {
    console.warn('[DB] Replacing open database with:', normalized)
    await closeDatabase()
  }

  activeDbFilePath = normalized

  await mkdir(dirname(normalized), { recursive: true })

  console.log(`[DB] Initializing sql.js database at: ${normalized}`)

  // Initialize sql.js WASM engine
  const SQL = await initSqlJs()

  let isFreshDb = false
  let fileBuffer: Buffer | undefined
  try {
    fileBuffer = await readFile(normalized)
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
      const corruptPath = `${normalized}.corrupt-${Date.now()}`
      try {
        await rename(normalized, corruptPath)
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
  createInitialSchemaOnSqlite(SQLjsDb)
  await backfillColorBuckets()

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

export { db }
export * from './schema'
