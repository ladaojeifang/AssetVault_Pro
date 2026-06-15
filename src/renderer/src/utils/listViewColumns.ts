import { i18n } from '../i18n'

/** 列表视图列：缩略图 | 名称 | 大小 | 类型 | 扩展名 | 导入日期 | 主色 */
export const LIST_COLUMN_COUNT = 7

export function getListColumnLabels(): string[] {
  const t = i18n.getFixedT(i18n.language, 'assets')
  return [
    t('columns.thumb'),
    t('columns.name'),
    t('columns.size'),
    t('columns.type'),
    t('columns.extension'),
    t('columns.importedAt'),
    t('columns.dominantColor')
  ]
}
/** 默认列宽（px），与原先 grid 比例接近 */
export const DEFAULT_LIST_COLUMN_WIDTHS: readonly number[] = [40, 200, 140, 84, 72, 100, 100]

export const MIN_LIST_COLUMN_WIDTHS: readonly number[] = [36, 72, 124, 72, 64, 80, 88]

export const MAX_LIST_COLUMN_WIDTHS: readonly number[] = [56, 640, 280, 180, 120, 180, 128]

/** @deprecated 历史：仅名称列拉伸；现改为多列按比例分配剩余宽度 */
export const LIST_FLEX_GROW_COLUMN_INDEX = 1

/** 窗口变宽时保持固定宽度、不参与 fr 分配的列（缩略图） */
export const LIST_FIXED_STRETCH_COLUMN_INDICES = new Set([0])

const STORAGE_KEY = 'assetvault.listColumnWidths.v2'

const LIST_GRID_GAP_PX = 8
const LIST_GRID_PAD_PX = 32

export function buildGridTemplateColumns(widths: number[], stretch = false): string {
  return widths
    .map((w, i) => {
      const px = Math.round(w)
      if (!stretch || LIST_FIXED_STRETCH_COLUMN_INDICES.has(i)) {
        return `${px}px`
      }
      const min = MIN_LIST_COLUMN_WIDTHS[i] ?? px
      // 按用户列宽比例分配剩余空间（非仅名称列）
      return `minmax(${min}px, ${px}fr)`
    })
    .join(' ')
}

export function listRowGridClass(stretch: boolean): string {
  const base = 'grid gap-x-2 gap-y-1 items-center px-4'
  return stretch ? `${base} w-full` : `${base} min-w-max`
}

export function listHeaderRowClass(stretch: boolean): string {
  const base = 'grid gap-x-2 gap-y-0 items-stretch px-4'
  return stretch ? `${base} w-full` : `${base} min-w-max`
}

/** @deprecated 使用 listRowGridClass(stretched) */
export const LIST_ROW_GRID_CLASS = listRowGridClass(false)

/** @deprecated 使用 listHeaderRowClass(stretched) */
export const LIST_HEADER_ROW_CLASS = listHeaderRowClass(false)

export function loadListColumnWidths(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_LIST_COLUMN_WIDTHS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length !== LIST_COLUMN_COUNT) {
      return [...DEFAULT_LIST_COLUMN_WIDTHS]
    }
    return parsed.map((v, i) => clampColumnWidth(i, Number(v)))
  } catch {
    return [...DEFAULT_LIST_COLUMN_WIDTHS]
  }
}

export function saveListColumnWidths(widths: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
  } catch {
    /* ignore quota */
  }
}

export function clampColumnWidth(index: number, width: number): number {
  const min = MIN_LIST_COLUMN_WIDTHS[index] ?? 40
  const max = MAX_LIST_COLUMN_WIDTHS[index] ?? 400
  if (!Number.isFinite(width)) return DEFAULT_LIST_COLUMN_WIDTHS[index] ?? min
  return Math.round(Math.min(max, Math.max(min, width)))
}

/** 表格最小宽度（固定列之和 + 名称列最小宽 + gap/padding） */
export function listTableMinWidth(widths: number[]): number {
  const cols = widths.reduce((sum, w) => sum + w, 0)
  const gaps = Math.max(0, widths.length - 1) * LIST_GRID_GAP_PX
  return cols + gaps + LIST_GRID_PAD_PX
}

