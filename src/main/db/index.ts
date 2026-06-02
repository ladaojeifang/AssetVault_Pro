import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { dirname, join, normalize } from 'path'
import { existsSync, mkdirSync, renameSync, readdirSync, statSync } from 'fs'
import { mkdir } from 'fs/promises'
import * as schema from './schema'
import { createInitialSchemaOnSqlite } from './sqliteSchema'
import { wrapBetterSqlite } from './rawSqlite'
import { backfillColorBuckets } from '../services/backfillColorBuckets'
import { ensureAssetSearchIndexBackfill } from '../services/assetSearchIndex'
import {
  BETTER_SQLITE_REBUILD_HINT,
  isBetterSqliteBindingsError,
  openBetterSqliteDatabase
} from './betterSqliteNative'

let db: ReturnType<typeof drizzle> | null = null
let sqliteDb: Database | null = null
/** Absolute path to the active library.sqlite (set in initDatabase). */
let activeDbFilePath: string | null = null

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function getRawSqlite(): Database {
  if (!sqliteDb) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return sqliteDb
}

/** Serialize writes; rolls back on failure. Safe for async fn on the main DB connection. */
export async function withSqliteTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const sqlite = getRawSqlite()
  sqlite.prepare('BEGIN IMMEDIATE').run()
  try {
    const result = await fn()
    sqlite.prepare('COMMIT').run()
    return result
  } catch (e) {
    try {
      sqlite.prepare('ROLLBACK').run()
    } catch {
      /* ignore rollback errors */
    }
    throw e
  }
}

function applyPragmas(raw: Database): void {
  raw.pragma('journal_mode = WAL')
  raw.pragma('synchronous = NORMAL')
  raw.pragma('cache_size = -64000')
  raw.pragma('foreign_keys = ON')
  raw.pragma('temp_store = MEMORY')
  raw.pragma('busy_timeout = 5000')
}

function walCheckpoint(raw: Database): void {
  try {
    raw.pragma('wal_checkpoint(TRUNCATE)')
  } catch (e) {
    console.warn('[DB] wal_checkpoint failed:', e)
  }
}

/**
 * Checkpoint WAL so readers / copy tools see a consistent main file.
 */
export async function flushDatabase(): Promise<void> {
  if (sqliteDb) walCheckpoint(sqliteDb)
}

/**
 * Close the database connection (e.g. before switching library root).
 */
export async function closeDatabase(): Promise<void> {
  if (sqliteDb) {
    walCheckpoint(sqliteDb)
    try {
      sqliteDb.close()
    } catch {
      /* ignore */
    }
    sqliteDb = null
  }
  db = null
  activeDbFilePath = null
}

function findLatestCorruptBackup(normalized: string): string | null {
  const dir = dirname(normalized)
  const base = normalized.split(/[/\\]/).pop() ?? 'library.sqlite'
  const prefix = `${base}.corrupt-`
  let best: { path: string; size: number; mtime: number } | null = null
  try {
    for (const name of readdirSync(dir)) {
      if (!name.startsWith(prefix)) continue
      const full = join(dir, name)
      const st = statSync(full)
      if (!st.isFile()) continue
      if (!best || st.mtimeMs > best.mtime || (st.mtimeMs === best.mtime && st.size > best.size)) {
        best = { path: full, size: st.size, mtime: st.mtimeMs }
      }
    }
  } catch {
    return null
  }
  return best && best.size > 4096 ? best.path : null
}

function openSqliteFile(normalized: string): Database {
  const hasFile = existsSync(normalized)
  const size = hasFile ? statSync(normalized).size : 0

  if (hasFile && size > 0) {
    try {
      const raw = openBetterSqliteDatabase(normalized)
      console.log('[DB] Opened existing database from disk')
      return raw
    } catch (openErr) {
      if (isBetterSqliteBindingsError(openErr)) {
        console.error('[DB] better-sqlite3 native module missing or wrong ABI:', openErr)
        throw new Error(
          `无法加载数据库原生模块（资料库文件未损坏）。\n${BETTER_SQLITE_REBUILD_HINT}`
        )
      }
      console.error('[DB] File exists but is not a valid SQLite DB; keeping a backup copy:', openErr)
      const corruptPath = `${normalized}.corrupt-${Date.now()}`
      try {
        renameSync(normalized, corruptPath)
        console.error(`[DB] Renamed unreadable DB to: ${corruptPath}`)
        console.error(
          `[DB] To restore index/archive data: quit the app, rename that file back to ${normalized}, then restart.`
        )
      } catch (renameErr) {
        console.error('[DB] Could not rename corrupt DB file:', renameErr)
      }
    }
  }

  const backup = findLatestCorruptBackup(normalized)
  if (backup) {
    try {
      const raw = openBetterSqliteDatabase(backup, { readonly: true })
      const row = raw.prepare('SELECT count(*) AS c FROM assets').get() as { c: number }
      raw.close()
      const count = Number(row?.c ?? 0)
      if (count > 0) {
        throw new Error(
          `资料库数据库无法打开，但发现备份 ${backup}（约 ${count} 条资产）。` +
            `请关闭应用后，将该文件复制/重命名为 ${normalized} 再启动。`
        )
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('资料库数据库无法打开')) throw e
      /* backup not readable — fall through */
    }
  }

  if (hasFile && size > 0) {
    throw new Error(
      `无法打开资料库数据库 ${normalized}。若目录下有 library.sqlite.corrupt-* 文件，请按日志说明恢复后再启动。`
    )
  }

  console.log('[DB] Creating new database file')
  return openBetterSqliteDatabase(normalized)
}

/**
 * Open library.sqlite with better-sqlite3 (file-backed WAL).
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

  console.log(`[DB] Initializing better-sqlite3 database at: ${normalized}`)

  sqliteDb = openSqliteFile(normalized)
  applyPragmas(sqliteDb)

  db = drizzle(sqliteDb, { schema })
  createInitialSchemaOnSqlite(wrapBetterSqlite(sqliteDb))
  await backfillColorBuckets()
  void ensureAssetSearchIndexBackfill().catch((e) =>
    console.error('[DB] assets_search backfill failed:', e)
  )

  console.log('[DB] Database initialized successfully')
}

export * from './schema'
