import type { ColorBucket } from './colorBucket'

export const SEARCH_DEBOUNCE_MS = 300

export type SizePreset = 'small' | 'medium' | 'large'
export type DatePreset = 'today' | 'week' | 'month' | 'year'

export const SIZE_PRESET_OPTIONS: ReadonlyArray<{ id: SizePreset; label: string }> = [
  { id: 'small', label: '小图' },
  { id: 'medium', label: '中图' },
  { id: 'large', label: '大图' }
] as const

export const DATE_PRESET_OPTIONS: ReadonlyArray<{ id: DatePreset; label: string }> = [
  { id: 'today', label: '今天' },
  { id: 'week', label: '本周' },
  { id: 'month', label: '本月' },
  { id: 'year', label: '今年' }
] as const

export type AssetFilterState = {
  colorBucket: ColorBucket | null
  sizePreset: SizePreset | null
  /** Inclusive min file size in megabytes (by `assets.file_size`). */
  fileSizeMinMb: number | null
  /** Inclusive max file size in megabytes. */
  fileSizeMaxMb: number | null
  datePreset: DatePreset | null
}

export function parseMbInput(raw: string): number | null {
  const t = raw.trim().replace(/,/g, '.')
  if (!t) return null
  const n = parseFloat(t)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function formatFileSizeMbFilterLabel(minMb: number | null, maxMb: number | null): string {
  if (minMb != null && maxMb != null) return `${minMb}–${maxMb} MB`
  if (minMb != null) return `≥ ${minMb} MB`
  if (maxMb != null) return `≤ ${maxMb} MB`
  return ''
}

export function hasActiveAssetFilters(f: AssetFilterState): boolean {
  return !!(
    f.colorBucket ||
    f.sizePreset ||
    f.fileSizeMinMb != null ||
    f.fileSizeMaxMb != null ||
    f.datePreset
  )
}

/** 任意筛选/搜索导致列表与文件夹浏览模式切换的条件 */
export function hasActiveAssetListQuery(p: {
  debouncedSearch?: string
  tagFilters?: string[]
  fileTypeFilter?: string | null
} & AssetFilterState): boolean {
  return !!(
    String(p.debouncedSearch ?? '').trim() ||
    (p.tagFilters?.length ?? 0) > 0 ||
    p.fileTypeFilter ||
    hasActiveAssetFilters(p)
  )
}
