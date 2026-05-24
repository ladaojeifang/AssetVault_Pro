import type { AssetItem } from '@/shared/types'

export const MASONRY_GAP = 8
export const MASONRY_COLUMN_WIDTH_MIN = 96
export const MASONRY_COLUMN_WIDTH_MAX = 420
export const MASONRY_COLUMN_WIDTH_DEFAULT = 180
export const MASONRY_COLUMN_WIDTH_STORAGE_KEY = 'assetvault-masonry-column-width'
export const MASONRY_COLUMN_WIDTH_CHANGED = 'assetvault:masonry-column-width-changed'

export interface MasonryItemLayout {
  assetId: string
  index: number
  column: number
  left: number
  top: number
  width: number
  height: number
  imageHeight: number
}

export interface MasonryLayoutResult {
  columnCount: number
  columnWidth: number
  gap: number
  totalHeight: number
  items: MasonryItemLayout[]
  /** Same items sorted by `top` for viewport culling */
  byTop: MasonryItemLayout[]
}

export function loadMasonryColumnWidth(): number {
  try {
    const raw = localStorage.getItem(MASONRY_COLUMN_WIDTH_STORAGE_KEY)
    const n = raw != null ? Number(raw) : NaN
    if (Number.isFinite(n)) {
      return clampColumnWidth(n)
    }
  } catch {
    /* ignore */
  }
  return MASONRY_COLUMN_WIDTH_DEFAULT
}

export function saveMasonryColumnWidth(width: number): void {
  const next = clampColumnWidth(width)
  try {
    localStorage.setItem(MASONRY_COLUMN_WIDTH_STORAGE_KEY, String(next))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(MASONRY_COLUMN_WIDTH_CHANGED, { detail: next })
    )
  }
}

export function clampColumnWidth(width: number): number {
  return Math.round(
    Math.min(MASONRY_COLUMN_WIDTH_MAX, Math.max(MASONRY_COLUMN_WIDTH_MIN, width))
  )
}

export function masonryColumnCount(
  containerWidth: number,
  columnWidth: number,
  gap: number = MASONRY_GAP
): number {
  if (containerWidth <= 0) return 1
  return Math.max(1, Math.floor((containerWidth + gap) / (columnWidth + gap)))
}

function assetAspectRatio(asset: AssetItem): number {
  if (asset.width && asset.height && asset.height > 0) {
    return asset.width / asset.height
  }
  switch (asset.fileType) {
    case 'video':
      return 16 / 9
    case 'font':
      return 1
    case 'document':
      return 3 / 4
    case 'audio':
      return 1.2
    default:
      return 1
  }
}

const CAPTION_BLOCK_HEIGHT = 34

export function assetImageHeight(asset: AssetItem, columnWidth: number): number {
  const ratio = assetAspectRatio(asset)
  const raw = columnWidth / ratio
  const minH = columnWidth * 0.5
  const maxH = columnWidth * 2.4
  return Math.min(maxH, Math.max(minH, raw))
}

export function assetTileHeight(
  asset: AssetItem,
  columnWidth: number,
  showCaption: boolean
): number {
  const imageH = assetImageHeight(asset, columnWidth)
  return imageH + (showCaption ? CAPTION_BLOCK_HEIGHT : 0)
}

export function computeMasonryLayout(
  assets: AssetItem[],
  containerWidth: number,
  columnWidth: number,
  showCaption: boolean,
  gap: number = MASONRY_GAP
): MasonryLayoutResult {
  const columnCount = masonryColumnCount(containerWidth, columnWidth, gap)
  const colHeights = new Array<number>(columnCount).fill(0)
  const items: MasonryItemLayout[] = []

  for (let index = 0; index < assets.length; index++) {
    const asset = assets[index]
    let col = 0
    for (let c = 1; c < columnCount; c++) {
      if (colHeights[c] < colHeights[col]) col = c
    }

    const imageHeight = assetImageHeight(asset, columnWidth)
    const height = imageHeight + (showCaption ? CAPTION_BLOCK_HEIGHT : 0)
    const left = col * (columnWidth + gap)
    const top = colHeights[col]

    items.push({
      assetId: asset.id,
      index,
      column: col,
      left,
      top,
      width: columnWidth,
      height,
      imageHeight
    })

    colHeights[col] += height + gap
  }

  const totalHeight = items.length > 0 ? Math.max(...colHeights, 0) - gap : 0
  const byTop = items.length > 0 ? [...items].sort((a, b) => a.top - b.top) : []

  return {
    columnCount,
    columnWidth,
    gap,
    totalHeight: Math.max(0, totalHeight),
    items,
    byTop
  }
}

/** Return masonry items intersecting the vertical viewport (coords relative to masonry root). */
export function getVisibleMasonryItems(
  byTop: MasonryItemLayout[],
  scrollTop: number,
  viewportHeight: number,
  masonryOffsetTop: number,
  overscan = 400
): MasonryItemLayout[] {
  if (byTop.length === 0) return []

  const viewStart = scrollTop - overscan
  const viewEnd = scrollTop + viewportHeight + overscan

  const result: MasonryItemLayout[] = []
  for (const item of byTop) {
    const itemTop = item.top + masonryOffsetTop
    const itemBottom = itemTop + item.height
    if (itemBottom < viewStart) continue
    if (itemTop > viewEnd) break
    result.push(item)
  }
  return result
}
