import { getDatabase } from '../db'
import { assets } from '../db/schema'
import { eq } from 'drizzle-orm'
import { finalizeAssetRecords } from './assetSearchIndex'
import { syncAssetSidecarFromDb } from './assetSidecar'
import { renameAsset } from './renameAsset'
import { localizeAssets } from './localizeAsset'
import { relinkAssetSource } from './libraryUpgrade'
import { getAssetById } from './assetQueryService'
import type { AssetItem } from '@/shared/types'

export async function updateAssetNotes(id: string, notes: unknown): Promise<boolean> {
  const database = getDatabase()
  const raw = typeof notes === 'string' ? notes : ''
  const trimmed = raw.slice(0, 16000)
  await database
    .update(assets)
    .set({ notes: trimmed.length > 0 ? trimmed : null, updatedAt: new Date() })
    .where(eq(assets.id, id))
  await finalizeAssetRecords(database, id)
  return true
}

const SOURCE_URL_MAX_LENGTH = 2048
const SOURCE_URL_PROTOCOL_REGEX = /^https?:\/\/.+/i

export async function updateAssetSourceUrl(id: string, raw: unknown): Promise<boolean> {
  const database = getDatabase()
  const text = typeof raw === 'string' ? raw.trim() : ''

  if (text.length === 0) {
    await database
      .update(assets)
      .set({ sourceUrl: null, updatedAt: new Date() })
      .where(eq(assets.id, id))
    await finalizeAssetRecords(database, id)
    return true
  }

  if (!SOURCE_URL_PROTOCOL_REGEX.test(text)) {
    throw new Error('仅支持 http:// 或 https:// 开头的合法 URL')
  }

  const safe = text.slice(0, SOURCE_URL_MAX_LENGTH)
  await database
    .update(assets)
    .set({ sourceUrl: safe, updatedAt: new Date() })
    .where(eq(assets.id, id))
  await finalizeAssetRecords(database, id)
  return true
}

export async function updateAssetMetadata(
  id: string,
  metadata: Record<string, unknown>
): Promise<boolean> {
  const database = getDatabase()
  await database
    .update(assets)
    .set({ metadata: JSON.stringify(metadata), updatedAt: new Date() })
    .where(eq(assets.id, id))
  await syncAssetSidecarFromDb(database, id)
  return true
}

export async function patchAsset(
  id: string,
  patch: { notes?: unknown; sourceUrl?: unknown; metadata?: Record<string, unknown> }
): Promise<ReturnType<typeof getAssetById>> {
  const existing = await getAssetById(id, { incrementViewCount: false })
  if (!existing) return null

  const errors: string[] = []

  if (patch.notes !== undefined) {
    try { await updateAssetNotes(id, patch.notes) } catch (e) {
      errors.push(`notes: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (patch.sourceUrl !== undefined) {
    try { await updateAssetSourceUrl(id, patch.sourceUrl) } catch (e) {
      errors.push(`sourceUrl: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (patch.metadata !== undefined) {
    try { await updateAssetMetadata(id, patch.metadata) } catch (e) {
      errors.push(`metadata: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`patchAsset partial failure: ${errors.join('; ')}`)
  }

  return getAssetById(id, { incrementViewCount: false })
}

export async function setAssetFavorite(id: string, favorite: boolean): Promise<AssetItem | null> {
  const database = getDatabase()
  const existing = await getAssetById(id, { incrementViewCount: false })
  if (!existing) return null

  await database
    .update(assets)
    .set({ isFavorite: favorite, updatedAt: new Date() })
    .where(eq(assets.id, id))

  return getAssetById(id, { incrementViewCount: false })
}

export { renameAsset, localizeAssets, relinkAssetSource }
