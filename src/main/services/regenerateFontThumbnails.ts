import { existsSync } from 'fs'
import { eq } from 'drizzle-orm'
import { getDatabase, persistDatabase } from '../db'
import { assets } from '../db/schema'
import type { FontRegenerateFailure, FontRegenerateResult } from '@/shared/fontTypes'
import { resolveLibraryPath, itemThumbRelative } from './libraryBundle'
import { parseFontFile } from './fontMetadata'
import { getThumbnailService } from './ThumbnailService'
import { FONT_THUMB_CANVAS_SIZE } from '../utils/fontPreviewRender'
import {
  getEffectiveThumbSampleText,
  getEffectiveThumbSampleVersion
} from './fontSettingsStore'
import { syncAssetSidecarFromDb } from './assetSidecar'

function parseThumbVersion(metadata: string | null | undefined): number | null {
  if (!metadata) return null
  try {
    const parsed = JSON.parse(metadata) as { font?: { thumbSampleVersion?: number } }
    return typeof parsed.font?.thumbSampleVersion === 'number' ? parsed.font.thumbSampleVersion : null
  } catch {
    return null
  }
}

export async function regenerateFontThumbnails(
  onProgress?: (data: { current: number; total: number; assetId: string; status: 'processing' | 'done' | 'error' }) => void,
  options?: { forceAll?: boolean }
): Promise<FontRegenerateResult> {
  const database = getDatabase()
  const rows = await database.select().from(assets).where(eq(assets.fileType, 'font')).all()
  const forceAll = options?.forceAll !== false
  const targetVersion = getEffectiveThumbSampleVersion()
  const sampleText = getEffectiveThumbSampleText()

  let updated = 0
  let skipped = 0
  let errors = 0
  const failures: FontRegenerateFailure[] = []
  const total = rows.length
  const thumbService = getThumbnailService()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    onProgress?.({ current: i + 1, total, assetId: row.id, status: 'processing' })

    const abs = resolveLibraryPath(row.filePath)
    if (!existsSync(abs)) {
      errors++
      failures.push({ assetId: row.id, filename: row.filename, reason: '字体文件不存在' })
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'error' })
      continue
    }

    const relThumb = itemThumbRelative(row.id)
    const storedVersion = parseThumbVersion(row.metadata)
    const upToDate = storedVersion === targetVersion && row.hasThumbnail

    if (!forceAll && upToDate) {
      skipped++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'done' })
      continue
    }

    try {
      let metadataObj: Record<string, unknown> = {}
      if (row.metadata) {
        try {
          metadataObj = JSON.parse(row.metadata) as Record<string, unknown>
        } catch {
          metadataObj = {}
        }
      }

      const existingFont = (metadataObj.font as { ttcIndex?: number } | undefined)?.ttcIndex ?? 0
      const parsed = parseFontFile(abs, sampleText, existingFont, targetVersion)
      if (parsed) metadataObj.font = parsed

      const thumb = await thumbService.generateFont(abs, row.id, {
        width: FONT_THUMB_CANVAS_SIZE,
        height: FONT_THUMB_CANVAS_SIZE,
        quality: 85,
        sampleText,
        ttcIndex: existingFont,
        force: true
      })

      if (!thumb) {
        errors++
        failures.push({ assetId: row.id, filename: row.filename, reason: '缩略图渲染失败' })
        onProgress?.({ current: i + 1, total, assetId: row.id, status: 'error' })
        continue
      }

      await database
        .update(assets)
        .set({
          hasThumbnail: true,
          thumbnailPath: relThumb,
          metadata: Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : row.metadata,
          updatedAt: new Date()
        })
        .where(eq(assets.id, row.id))

      await syncAssetSidecarFromDb(database, row.id)
      updated++
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'done' })
    } catch (e) {
      console.error(`[Font] regenerate thumb failed ${row.id}:`, e)
      errors++
      failures.push({
        assetId: row.id,
        filename: row.filename,
        reason: e instanceof Error ? e.message : String(e)
      })
      onProgress?.({ current: i + 1, total, assetId: row.id, status: 'error' })
    }
  }

  if (updated > 0) persistDatabase()

  return { scanned: total, updated, skipped, errors, failures }
}
