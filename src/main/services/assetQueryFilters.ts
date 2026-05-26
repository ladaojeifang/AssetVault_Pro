import { gte, sql, type SQL } from 'drizzle-orm'
import { assets } from '../db/schema'
import type { ColorBucket } from '@/shared/colorBucket'
import type { DatePreset, SizePreset } from '@/shared/assetFilters'

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function datePresetCutoff(preset: DatePreset): Date {
  const now = new Date()
  switch (preset) {
    case 'today':
      return startOfLocalDay(now)
    case 'week': {
      const t = startOfLocalDay(now)
      t.setDate(t.getDate() - 6)
      return t
    }
    case 'month': {
      const t = startOfLocalDay(now)
      t.setDate(t.getDate() - 29)
      return t
    }
    case 'year': {
      const t = startOfLocalDay(now)
      t.setFullYear(t.getFullYear() - 1)
      return t
    }
    default:
      return startOfLocalDay(now)
  }
}

export function buildColorBucketCondition(bucket: ColorBucket): SQL {
  return sql`${assets.colorBucket} = ${bucket}`
}

export function buildSizePresetCondition(preset: SizePreset): SQL {
  switch (preset) {
    case 'small':
      return sql`(
        (${assets.width} IS NOT NULL AND ${assets.height} IS NOT NULL
          AND (CASE WHEN ${assets.width} > ${assets.height} THEN ${assets.width} ELSE ${assets.height} END) < 800)
        OR ((${assets.width} IS NULL OR ${assets.height} IS NULL) AND ${assets.fileSize} < 524288)
      )`
    case 'medium':
      return sql`(
        (${assets.width} IS NOT NULL AND ${assets.height} IS NOT NULL
          AND (CASE WHEN ${assets.width} > ${assets.height} THEN ${assets.width} ELSE ${assets.height} END) >= 800
          AND (CASE WHEN ${assets.width} > ${assets.height} THEN ${assets.width} ELSE ${assets.height} END) <= 1920)
        OR ((${assets.width} IS NULL OR ${assets.height} IS NULL)
          AND ${assets.fileSize} >= 524288 AND ${assets.fileSize} <= 5242880)
      )`
    case 'large':
      return sql`(
        (${assets.width} IS NOT NULL AND ${assets.height} IS NOT NULL
          AND (CASE WHEN ${assets.width} > ${assets.height} THEN ${assets.width} ELSE ${assets.height} END) > 1920)
        OR ((${assets.width} IS NULL OR ${assets.height} IS NULL) AND ${assets.fileSize} > 5242880)
      )`
    default:
      return sql`1=1`
  }
}

export function buildFileSizeMbCondition(
  minMb?: number | null,
  maxMb?: number | null
): SQL | null {
  const parts: SQL[] = []
  if (minMb != null && minMb >= 0) {
    const minBytes = Math.floor(Number(minMb) * 1024 * 1024)
    if (Number.isFinite(minBytes)) parts.push(sql`${assets.fileSize} >= ${minBytes}`)
  }
  if (maxMb != null && maxMb >= 0) {
    const maxBytes = Math.floor(Number(maxMb) * 1024 * 1024)
    if (Number.isFinite(maxBytes)) parts.push(sql`${assets.fileSize} <= ${maxBytes}`)
  }
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]!
  return sql`(${sql.join(parts, sql` AND `)})`
}

export function buildDatePresetCondition(preset: DatePreset): SQL {
  const cutoff = datePresetCutoff(preset)
  // better-sqlite3 rejects Date in raw sql binds; drizzle maps Date → unix for timestamp columns.
  return gte(assets.importedAt, cutoff)
}
