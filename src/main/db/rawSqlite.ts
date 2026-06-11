import type { SqliteDatabase } from './sqliteTypes'

/** Thin wrapper so schema/migrations use sql.js-style `run` on better-sqlite3. */
export type RawSqliteDb = {
  exec(sql: string): void
  run(sql: string, params?: unknown[]): void
  getScalarInt(sql: string): number | null
}

export function wrapBetterSqlite(db: SqliteDatabase): RawSqliteDb {
  return {
    exec(sql: string) {
      db.exec(sql)
    },
    run(sql: string, params?: unknown[]) {
      if (params != null && params.length > 0) {
        db.prepare(sql).run(...params)
      } else {
        db.exec(sql)
      }
    },
    getScalarInt(sql: string) {
      return execSelectInt(db, sql)
    }
  }
}

export function execSelectInt(db: SqliteDatabase, sql: string): number | null {
  try {
    const row = db.prepare(sql).get() as Record<string, unknown> | undefined
    if (!row) return null
    const v = Object.values(row)[0]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (v != null && !Number.isNaN(Number(v))) return Number(v)
  } catch {
    /* no table or empty */
  }
  return null
}
