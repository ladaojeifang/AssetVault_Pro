import { openBetterSqliteDatabase, isBetterSqliteBindingsError } from '@main/db/betterSqliteNative'

let cached: boolean | null = null

/** True when better-sqlite3 bindings match the current Node/Electron runtime. */
export function canRunSqliteIntegrationTests(): boolean {
  if (cached !== null) return cached
  try {
    const db = openBetterSqliteDatabase(':memory:')
    db.close()
    cached = true
  } catch (e) {
    if (isBetterSqliteBindingsError(e)) {
      console.warn(
        '[testing] Skipping SQLite integration tests: better-sqlite3 ABI mismatch. Run `pnpm run rebuild:native`.'
      )
    }
    cached = false
  }
  return cached
}
