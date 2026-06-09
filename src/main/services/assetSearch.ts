import { sql, type SQL } from 'drizzle-orm'
import { assets } from '../db/schema'

/** Split user query into lowercase tokens (AND semantics). */
export function tokenizeSearchQuery(raw: string): string[] {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

/**
 * Per-token match via EXISTS on assets_search + filename/original_name.
 * Uses instr(lower(...)) so underscores and other LIKE metacharacters stay literal.
 */
export function buildSearchCondition(tokens: string[]): SQL | null {
  if (tokens.length === 0) return null

  const tokenConditions = tokens.map((token) => {
    return sql`(
      EXISTS (
        SELECT 1 FROM assets_search s
        WHERE s.asset_id = ${assets.id}
        AND instr(lower(s.search_text), ${token}) > 0
      )
      OR instr(lower(${assets.filename}), ${token}) > 0
      OR instr(lower(${assets.originalName}), ${token}) > 0
    )`
  })

  return sql`(${sql.join(tokenConditions, sql` AND `)})`
}
