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
  datePreset: DatePreset | null
}

export function hasActiveAssetFilters(f: AssetFilterState): boolean {
  return !!(f.colorBucket || f.sizePreset || f.datePreset)
}
