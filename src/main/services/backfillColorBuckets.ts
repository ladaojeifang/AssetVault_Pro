import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import { classifyColorBucket } from '@/shared/colorBucket'

/** One-time fill for libraries imported before color_bucket column existed. */
export async function backfillColorBuckets(): Promise<void> {
  const database = getDatabase()
  const rows = await database
    .select({ id: assets.id, dominantColor: assets.dominantColor })
    .from(assets)
    .where(and(isNotNull(assets.dominantColor), isNull(assets.colorBucket)))
    .all()

  if (rows.length === 0) return

  let n = 0
  for (const row of rows) {
    const bucket = classifyColorBucket(row.dominantColor)
    if (!bucket) continue
    await database.update(assets).set({ colorBucket: bucket }).where(eq(assets.id, row.id))
    n++
  }
}
