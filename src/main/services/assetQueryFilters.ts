import { sql, type SQL } from 'drizzle-orm'
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

export function buildDatePresetCondition(preset: DatePreset): SQL {
  const cutoff = datePresetCutoff(preset)
  return sql`${assets.importedAt} >= ${cutoff}`
}
