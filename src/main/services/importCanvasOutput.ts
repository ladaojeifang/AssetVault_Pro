import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import { importSingleAsset } from './importSingleAsset'
import { syncAssetSidecarFromDb } from './assetSidecar'
import { sanitizeStorageFileName } from './libraryBundle'

export interface ImportCanvasOutputOptions {
  pngBase64: string
  filename: string
  canvasId: string
  nodeId: string
  targetFolderId?: string
}

export interface ImportCanvasOutputResult {
  assetId: string
}

function parseExistingMetadata(raw: string | null | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export async function importCanvasOutputFromPng(
  options: ImportCanvasOutputOptions
): Promise<ImportCanvasOutputResult | null> {
  const database = getDatabase()
  const buffer = Buffer.from(options.pngBase64, 'base64')
  if (buffer.length < 32) {
    console.warn('[aiCanvas] import output: empty PNG buffer')
    return null
  }

  const dir = join(app.getPath('temp'), 'assetvault-canvas-import')
  await mkdir(dir, { recursive: true })

  const base = sanitizeStorageFileName(
    options.filename.toLowerCase().endsWith('.png') ? options.filename : `${options.filename}.png`
  )
  const tempPath = join(dir, `${uuidv4().slice(0, 8)}-${base}`)
  await writeFile(tempPath, buffer)

  const assetId = await importSingleAsset(tempPath, options.targetFolderId)
  if (!assetId) return null

  const row = await database
    .select({ metadata: assets.metadata })
    .from(assets)
    .where(eq(assets.id, assetId))
    .get()

  const meta = parseExistingMetadata(row?.metadata ?? null)
  meta.aiCanvas = {
    canvasId: options.canvasId,
    nodeId: options.nodeId,
    role: 'output',
    importedAt: new Date().toISOString()
  }

  await database
    .update(assets)
    .set({ metadata: JSON.stringify(meta), updatedAt: new Date() })
    .where(eq(assets.id, assetId))

  await syncAssetSidecarFromDb(database, assetId)

  return { assetId }
}
