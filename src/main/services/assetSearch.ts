import { sql, type SQL } from 'drizzle-orm'
import { assets } from '../db/schema'

export function escapeSqlLikePattern(raw: string): string {
  return raw.replace(/\\/g, ' ').replace(/%/g, ' ').replace(/_/g, ' ')
}

/** Split user query into lowercase tokens (AND semantics). */
export function tokenizeSearchQuery(raw: string): string[] {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => escapeSqlLikePattern(t))
    .filter((t) => t.length > 0)
}

/**
 * Per-token match via EXISTS on assets_search + filename/original_name.
 * Avoids loading all matching IDs into JS (FTS5 alternative for sql.js).
 */
export function buildSearchCondition(tokens: string[]): SQL | null {
  if (tokens.length === 0) return null

  const tokenConditions = tokens.map((token) => {
    const pattern = `%${token}%`
    return sql`(
      EXISTS (
        SELECT 1 FROM assets_search s
        WHERE s.asset_id = ${assets.id}
        AND s.search_text LIKE ${pattern}
      )
      OR ${assets.filename} LIKE ${pattern}
      OR ${assets.originalName} LIKE ${pattern}
    )`
  })

  return sql`(${sql.join(tokenConditions, sql` AND `)})`
}
