import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssetItem } from '@/shared/types'
import { formatFileSize } from '@/shared/types'
import { isModel3dPreviewExtension } from '@/shared/model3dFormats'
import { FileTypePlaceholder } from '../Common/FileTypePlaceholder'
import {
  MASONRY_GAP,
  MASONRY_COLUMN_WIDTH_CHANGED,
  clampColumnWidth,
  computeMasonryLayout,
  getVisibleMasonryItems,
  loadMasonryColumnWidth,
  saveMasonryColumnWidth
} from '../../utils/masonryLayout'

const ZOOM_WHEEL_STEP = 14

export interface MasonryGridProps {
  assets: AssetItem[]
  scrollElementRef: React.RefObject<HTMLElement | null>
  /** Bump when folder chrome above the grid changes height */
  layoutKey?: string
  selectedIds: Set<string>
  showCaptions?: boolean
  onAssetClick: (id: string, e: React.MouseEvent) => void
  onAssetDoubleClick: (id: string) => void
  onDragStart: (
    e: React.DragEvent,
    asset: { id: string; filename: string; filePath: string; resolvedFilePath?: string }
  ) => void
  onAssetContextMenu: (e: React.MouseEvent, asset: AssetItem) => void
}

const MasonryGrid: React.FC<MasonryGridProps> = ({
  assets,
  scrollElementRef,
  layoutKey = '',
  selectedIds,
  showCaptions = false,
  onAssetClick,
  onAssetDoubleClick,
  onDragStart,
  onAssetContextMenu
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const [columnWidth, setColumnWidth] = useState(loadMasonryColumnWidth)
  const [containerWidth, setContainerWidth] = useState(0)
  const [masonryOffsetTop, setMasonryOffsetTop] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(800)

  const measureLayout = useCallback(() => {
    const root = rootRef.current
    const scrollEl = scrollElementRef.current
    if (!root) return
    setContainerWidth(root.clientWidth)
    if (scrollEl) {
      setMasonryOffsetTop(root.offsetTop)
      setScrollTop(scrollEl.scrollTop)
      setViewportHeight(scrollEl.clientHeight)
    }
  }, [scrollElementRef])

  useLayoutEffect(() => {
    measureLayout()
    const root = rootRef.current
    if (!root) return
    const ro = new ResizeObserver(() => measureLayout())
    ro.observe(root)
    return () => ro.disconnect()
  }, [measureLayout, assets.length, showCaptions, layoutKey])

  useLayoutEffect(() => {
    measureLayout()
  }, [layoutKey, measureLayout])

  useEffect(() => {
    const scrollEl = scrollElementRef.current
    if (!scrollEl) return

    const onScroll = () => {
      setScrollTop(scrollEl.scrollTop)
      setViewportHeight(scrollEl.clientHeight)
      const root = rootRef.current
      if (root) setMasonryOffsetTop(root.offsetTop)
    }

    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [scrollElementRef, assets.length])

  useEffect(() => {
    const onWidthChanged = (e: Event) => {
      const w = (e as CustomEvent<number>).detail
      if (typeof w === 'number' && Number.isFinite(w)) {
        setColumnWidth(clampColumnWidth(w))
      }
    }
    window.addEventListener(MASONRY_COLUMN_WIDTH_CHANGED, onWidthChanged)
    return () => window.removeEventListener(MASONRY_COLUMN_WIDTH_CHANGED, onWidthChanged)
  }, [])

  useEffect(() => {
    const scrollEl = scrollElementRef.current
    if (!scrollEl) return

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_WHEEL_STEP : ZOOM_WHEEL_STEP
      setColumnWidth((w) => {
        const next = clampColumnWidth(w + delta)
        saveMasonryColumnWidth(next)
        return next
      })
    }

    scrollEl.addEventListener('wheel', onWheel, { passive: false })
    return () => scrollEl.removeEventListener('wheel', onWheel)
  }, [scrollElementRef])

  const layout = useMemo(
    () =>
      computeMasonryLayout(
        assets,
        containerWidth > 0 ? containerWidth : 800,
        columnWidth,
        showCaptions,
        MASONRY_GAP
      ),
    [assets, containerWidth, columnWidth, showCaptions]
  )

  const assetById = useMemo(() => {
    const m = new Map<string, AssetItem>()
    for (const a of assets) m.set(a.id, a)
    return m
  }, [assets])

  const visibleItems = useMemo(
    () =>
      getVisibleMasonryItems(
        layout.byTop,
        scrollTop,
        viewportHeight,
        masonryOffsetTop,
        500
      ),
    [layout.byTop, scrollTop, viewportHeight, masonryOffsetTop]
  )

  return (
    <div ref={rootRef} className="w-full min-h-[120px]">
      <div
        className="relative w-full"
        style={{ height: layout.totalHeight > 0 ? layout.totalHeight : 1 }}
      >
        {visibleItems.map((item) => {
          const asset = assetById.get(item.assetId)
          if (!asset) return null
          return (
            <div
              key={asset.id}
              className="absolute min-w-0"
              style={{
                left: item.left,
                top: item.top,
                width: item.width,
                height: item.height
              }}
            >
              <MasonryAssetTile
                asset={asset}
                imageHeight={item.imageHeight}
                selected={selectedIds.has(asset.id)}
                showCaption={showCaptions}
                onClick={(e) => onAssetClick(asset.id, e)}
                onDoubleClick={() => onAssetDoubleClick(asset.id)}
                onDragStart={(e) => onDragStart(e, asset)}
                onContextMenu={(e) => onAssetContextMenu(e, asset)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MasonryAssetTile({
  asset,
  imageHeight,
  selected,
  showCaption,
  onClick,
  onDoubleClick,
  onDragStart,
  onContextMenu
}: {
  asset: AssetItem
  imageHeight: number
  selected: boolean
  showCaption?: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const { t } = useTranslation('assets')
  const [imgError, setImgError] = useState(false)
  const can3dPreview = asset.fileType === '3d' && isModel3dPreviewExtension(asset.extension)

  return (
    <div className="flex flex-col h-full min-w-0">
      <div
        draggable
        onDragStart={onDragStart}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        style={{ height: imageHeight }}
        className={`group relative w-full rounded-lg overflow-hidden cursor-pointer transition-all duration-150 shrink-0 ${
          selected
            ? 'ring-2 ring-av-accent-blue shadow-lg shadow-av-accent-blue/20'
            : 'hover:ring-2 hover:ring-av-border-light hover:shadow-md'
        }`}
      >
        <div className="absolute inset-0 bg-av-bg-tertiary">
          {!imgError &&
          (asset.fileType === 'image' ||
            asset.fileType === 'video' ||
            asset.fileType === 'font' ||
            can3dPreview ||
            asset.hasThumbnail) ? (
            <MasonryThumbnail
              assetId={asset.id}
              cacheKey={asset.updatedAt}
              objectFit={asset.fileType === 'font' ? 'contain' : 'cover'}
              retryWhileEmpty={can3dPreview && !asset.hasThumbnail}
              onError={() => setImgError(true)}
            />
          ) : (
            <FileTypePlaceholder
              fileType={asset.fileType}
              extension={asset.extension}
              color={asset.dominantColor}
              size="sm"
            />
          )}

          {asset.storageMode === 'referenced' && (
            <div
              className={`absolute top-2 right-2 text-[9px] font-medium px-1.5 py-0.5 rounded z-10 ${
                asset.sourceMissing
                  ? 'bg-red-900/80 text-red-100'
                  : 'bg-black/55 text-amber-200'
              }`}
              title={asset.sourceMissing ? t('sourceMissingTitle') : t('referenceOnlyTitle')}
            >
              {asset.sourceMissing ? t('missing') : t('reference')}
            </div>
          )}

          {selected && (
            <div className="absolute top-2 left-2 w-5 h-5 rounded bg-av-accent-blue flex items-center justify-center z-10">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
                <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          )}

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-150 flex items-end justify-between p-2 opacity-0 group-hover:opacity-100 z-10">
            <span className="text-[10px] text-white font-medium truncate max-w-[70%]">
              {asset.filename}
            </span>
            <span className="text-[10px] text-white/80">{formatFileSize(asset.fileSize)}</span>
          </div>
        </div>
      </div>
      {showCaption && (
        <div className="mt-1.5 px-0.5 space-y-0.5 shrink-0">
          <p className="text-xs truncate text-av-text-primary leading-tight">{asset.filename}</p>
          {asset.width && asset.height ? (
            <p className="text-[10px] text-av-text-muted tabular-nums">
              {asset.width} × {asset.height}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}

const MasonryThumbnail = ({
  assetId,
  cacheKey,
  objectFit = 'cover',
  retryWhileEmpty = false,
  onError
}: {
  assetId: string
  cacheKey?: string | number
  objectFit?: 'cover' | 'contain'
  retryWhileEmpty?: boolean
  onError: () => void
}) => {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let attempt = 0
    const maxAttempts = retryWhileEmpty ? 24 : 1

    const load = () => {
      setSrc(null)
      void window.assetVaultAPI.assets
        .getThumbnail(assetId)
        .then((data) => {
          if (cancelled) return
          if (data) {
            setSrc(data as string)
            return
          }
          if (retryWhileEmpty && attempt < maxAttempts - 1) {
            attempt++
            window.setTimeout(load, Math.min(8000, 1500 + attempt * 1000))
          }
        })
        .catch(() => {
          if (!cancelled && retryWhileEmpty && attempt < maxAttempts - 1) {
            attempt++
            window.setTimeout(load, Math.min(8000, 1500 + attempt * 1000))
          }
        })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [assetId, cacheKey, retryWhileEmpty])

  if (!src) {
    return <div className="w-full h-full animate-pulse bg-av-bg-elevated" />
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="w-full h-full"
      style={{ objectFit }}
      onError={onError}
    />
  )
}

export default MasonryGrid
