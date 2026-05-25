import { existsSync, readFileSync } from 'fs'
import { eq } from 'drizzle-orm'
import { getDatabase, persistDatabase } from '../db'
import { assets } from '../db/schema'
import { classifyColorBucket } from '@/shared/colorBucket'
import type { AssetColorAnalysis } from './analyzeAssetColors'
import { syncAssetSidecarFromDb } from './assetSidecar'
import { extractPaletteFromImageBuffer, serializePaletteColors } from '../utils/colorPalette'

type Database = ReturnType<typeof getDatabase>

export async function persistAssetColorAnalysis(
  database: Database,
  assetId: string,
  analysis: AssetColorAnalysis
): Promise<void> {
  const colorBucket = classifyColorBucket(analysis.dominantColor)
  await database
    .update(assets)
    .set({
      dominantColor: analysis.dominantColor,
      colors: analysis.colorsJson,
      colorBucket: colorBucket ?? null,
      updatedAt: new Date()
    })
    .where(eq(assets.id, assetId))
  await syncAssetSidecarFromDb(database, assetId)
  persistDatabase()
}

/** Analyze palette from an on-disk thumbnail (e.g. after 3D render). */
export async function tryAutoColorFromThumbnail(
  database: Database,
  assetId: string,
  thumbAbsPath: string
): Promise<void> {
  const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!row || row.dominantColor) return

  if (!existsSync(thumbAbsPath)) return

  try {
    const buffer = readFileSync(thumbAbsPath)
    const palette = await extractPaletteFromImageBuffer(buffer)
    await persistAssetColorAnalysis(database, assetId, {
      dominantColor: palette.dominantColor,
      colors: palette.colors,
      colorsJson: serializePaletteColors(palette.colors)
    })
  } catch (e) {
    console.warn('[Color] thumbnail palette failed:', assetId, e)
  }
}
