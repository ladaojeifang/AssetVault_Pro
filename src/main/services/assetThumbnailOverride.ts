import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { eq } from 'drizzle-orm'
import { clipboard } from 'electron'
import { getDatabase } from '../db'
import { assets } from '../db/schema'
import { resolveLibraryPath, itemThumbRelative } from './libraryBundle'
import { getThumbnailService } from './ThumbnailService'
import {
  clearCustomThumbnail,
  writeCustomThumbnailFromImageBytes
} from './customThumbnail'
import { clearModelThumbnailSkip } from './modelThumbnailSkip'
import { isModel3dPreviewExtension } from '@/shared/model3dFormats'
import { syncAssetSidecarFromDb } from './assetSidecar'
import { getEffectiveThumbSampleText } from './fontSettingsStore'
import { parseFontFile } from './fontMetadata'
import { FONT_THUMB_CANVAS_SIZE } from '../utils/fontPreviewRender'
import { notifyAllWindowsAssetsImported } from './importNotify'

type Database = ReturnType<typeof getDatabase>

export async function setCustomThumbnailFromFile(
  database: Database,
  assetId: string,
  sourcePath: string
): Promise<void> {
  const bytes = await readFile(sourcePath)
  await applyCustomThumbnail(database, assetId, bytes)
}

export async function setCustomThumbnailFromClipboard(
  database: Database,
  assetId: string
): Promise<void> {
  const img = clipboard.readImage()
  if (img.isEmpty()) {
    throw new Error('剪贴板中没有图片')
  }
  await applyCustomThumbnail(database, assetId, Buffer.from(img.toPNG()))
}

async function applyCustomThumbnail(
  database: Database,
  assetId: string,
  imageBytes: Buffer
): Promise<void> {
  const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!row) throw new Error('资产不存在')

  await writeCustomThumbnailFromImageBytes(assetId, imageBytes)

  await database
    .update(assets)
    .set({
      thumbnailPath: itemThumbRelative(assetId),
      hasThumbnail: true,
      updatedAt: new Date()
    })
    .where(eq(assets.id, assetId))

  await syncAssetSidecarFromDb(database, assetId)
  notifyAllWindowsAssetsImported()
}

export async function refreshAssetThumbnail(
  database: Database,
  assetId: string
): Promise<boolean> {
  const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
  if (!row) throw new Error('资产不存在')

  clearCustomThumbnail(assetId)
  if (row.fileType === '3d') clearModelThumbnailSkip(assetId)

  const thumbService = getThumbnailService()
  thumbService.invalidate(assetId)

  const absFile = row.filePath ? resolveLibraryPath(row.filePath) : ''
  if (!absFile || !existsSync(absFile)) {
    await database
      .update(assets)
      .set({ hasThumbnail: false, thumbnailPath: null, updatedAt: new Date() })
      .where(eq(assets.id, assetId))
    notifyAllWindowsAssetsImported()
    return false
  }

  let gen = null
  const ext = row.extension

  const thumbOpts = thumbService.getGenerationDefaults()
  if (row.fileType === 'image') {
    gen = await thumbService.generate(absFile, assetId, thumbOpts)
  } else if (row.fileType === 'video') {
    gen = await thumbService.generateVideo(absFile, assetId, thumbOpts)
  } else if (row.fileType === 'font') {
    const parsed = parseFontFile(absFile, getEffectiveThumbSampleText(), 0)
    gen = await thumbService.generateFont(absFile, assetId, {
      width: FONT_THUMB_CANVAS_SIZE,
      height: FONT_THUMB_CANVAS_SIZE,
      quality: 85,
      sampleText: getEffectiveThumbSampleText(),
      ttcIndex: parsed?.ttcIndex ?? 0,
      force: true
    })
  } else if (row.fileType === '3d' && isModel3dPreviewExtension(ext)) {
    gen = await thumbService.generateModel(absFile, assetId, ext, {
      ...thumbOpts,
      force: true
    })
  }

  if (!gen?.buffer?.length) {
    await database
      .update(assets)
      .set({ hasThumbnail: false, thumbnailPath: null, updatedAt: new Date() })
      .where(eq(assets.id, assetId))
    await syncAssetSidecarFromDb(database, assetId)
    notifyAllWindowsAssetsImported()
    return false
  }

  const relThumb =
    gen.usedOriginal && row.extension?.toLowerCase() !== '.exr' ? row.filePath : itemThumbRelative(assetId)
  await database
    .update(assets)
    .set({
      thumbnailPath: relThumb,
      hasThumbnail: true,
      updatedAt: new Date()
    })
    .where(eq(assets.id, assetId))

  await syncAssetSidecarFromDb(database, assetId)
  notifyAllWindowsAssetsImported()
  return true
}

export { isCustomThumbnail } from './customThumbnail'
