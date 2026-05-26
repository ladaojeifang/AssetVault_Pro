import { db } from '../db'
import { assets } from '../db/schema'
import { eq, or } from 'drizzle-orm'

type Database = NonNullable<typeof db>

/** Resolve an on-disk path to an asset id (import_source or catalog file_path). */
export async function findAssetIdByCanonicalPath(
  database: Database,
  canonicalPath: string
): Promise<string | null> {
  const row = await database
    .select({ id: assets.id })
    .from(assets)
    .where(or(eq(assets.importSource, canonicalPath), eq(assets.filePath, canonicalPath)))
    .get()
  return row?.id ?? null
}
