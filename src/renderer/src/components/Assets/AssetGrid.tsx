import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Virtualizer } from '@tanstack/virtual-core'
import { useApp } from '../../stores/AppContext'
import { resolveDroppedFilePaths } from '../../utils/resolveDroppedFilePaths'
import { formatFileSize } from '@/shared/types' // We'll add this utility

const AssetGrid: React.FC = () => {
  const {
    assets,
    totalAssets,
    isLoading,
    isLoadingMore,
    hasMoreAssets,
    viewMode,
    selectedAssetIds,
    selectAsset,
    selectMultiple,
    setDetailPanelOpen,
    loadMoreAssets
  } = useApp()

  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<string | null>(null)

  const COLS = 8

  // Virtual scrolling for grid mode (row = one row of COLS tiles)
  const rowVirtualizer = useVirtualizer<Element, Element>({
    count: Math.max(1, Math.ceil(assets.length / COLS)),
    getScrollElement: () => containerRef.current,
    estimateSize: () => (viewMode === 'grid' ? 220 : 56),
    overscan: 4
  })

  const listVirtualizer = useVirtualizer<Element, Element>({
    count: assets.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 56,
    overscan: 10
  })

  useEffect(() => {
    const root = containerRef.current
    const target = sentinelRef.current
    if (!root || !target || !hasMoreAssets) return

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting)
        if (hit) loadMoreAssets()
      },
      { root, rootMargin: '320px', threshold: 0 }
    )
    io.observe(target)
    return () => io.disconnect()
  }, [hasMoreAssets, loadMoreAssets, assets.length, viewMode, totalAssets])

  const handleAssetClick = useCallback(
    (id: string, event: React.MouseEvent) => {
      if (event.ctrlKey || event.metaKey) {
        selectAsset(id) // Toggle selection
      } else {
        selectMultiple([id]) // Single select
        setDetailPanelOpen(true)
      }
    },
    [selectAsset, selectMultiple, setDetailPanelOpen]
  )

  const handleAssetDoubleClick = useCallback(
    async (id: string) => {
      // Open the asset in the system's default application
      const asset = assets.find((a) => a.id === id)
      if (asset?.filePath) {
        await window.assetVaultAPI.fs.openInExplorer(asset.filePath)
      }
    },
    [assets]
  )

  const handleDragStart = (e: React.DragEvent, asset: { id: string; filename: string; filePath: string }) => {
    dragStartRef.current = asset.id
    e.dataTransfer.effectAllowed = 'copyMove'
    try {
      e.dataTransfer.setData('text/plain', asset.filename || 'asset')
      e.dataTransfer.setData('application/x-assetvault-asset-id', asset.id)
    } catch {
      // Some platforms restrict custom MIME types during drag
    }
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        selectMultiple(assets.map((a) => a.id))
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAssetIds.size > 0) {
        e.preventDefault()
        handleDelete()
      }
      if (e.key === 'Escape') {
        selectMultiple([])
        setDetailPanelOpen(false)
      }
    },
    [assets, selectedAssetIds, selectMultiple]
  )

  async function handleDelete() {
    if (selectedAssetIds.size === 0) return
    if (!confirm(`Delete ${selectedAssetIds.size} item(s)?`)) return

    await window.assetVaultAPI.assets.delete(Array.from(selectedAssetIds))
    selectMultiple([])
    // Refresh will be handled by parent
  }

  // Keyboard navigation
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('keydown', handleKeyDown as any)
    return () => el.removeEventListener('keydown', handleKeyDown as any)
  }, [handleKeyDown])

  if (isLoading && assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-av-text-muted">
          <div className="w-12 h-12 rounded-full bg-av-bg-elevated flex items-center justify-center animate-spin-slow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <circle cx="12" cy="12" r="10" opacity="0.3" />
              <path d="M12 2a10 10 0 010 20" />
            </svg>
          </div>
          <span className="text-sm">Loading assets...</span>
        </div>
      </div>
    )
  }

  if (!isLoading && assets.length === 0) {
    return (
      <EmptyState />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar / Info bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-av-border/50 shrink-0">
        <span className="text-xs text-av-text-muted">
          {totalAssets.toLocaleString()} assets
          {assets.length < totalAssets && (
            <span className="text-av-text-secondary"> · {assets.length.toLocaleString()} in view</span>
          )}
          {selectedAssetIds.size > 0 && ` · ${selectedAssetIds.size} selected`}
        </span>
        {isLoadingMore && <span className="text-xs text-av-accent-blue">Loading more…</span>}
      </div>

      {/* Grid/List content with virtual scroll */}
      <div
        ref={containerRef}
        tabIndex={0}
        className={`flex-1 overflow-auto outline-none ${
          viewMode === 'grid' ? 'p-4' : ''
        }`}
        style={{
          contain: 'strict'
        }}
      >
        {viewMode === 'grid' ? (
          <GridContent
            assets={assets}
            columns={COLS}
            virtualizer={rowVirtualizer}
            selectedIds={selectedAssetIds}
            onAssetClick={handleAssetClick}
            onAssetDoubleClick={handleAssetDoubleClick}
            onDragStart={handleDragStart}
          />
        ) : (
          <ListContent
            assets={assets}
            virtualizer={listVirtualizer}
            selectedIds={selectedAssetIds}
            onAssetClick={handleAssetClick}
            onAssetDoubleClick={handleAssetDoubleClick}
            onDragStart={handleDragStart}
          />
        )}
        {hasMoreAssets && <div ref={sentinelRef} className="h-8 w-full shrink-0" aria-hidden />}
      </div>
    </div>
  )
}

// Grid View Component
function GridContent({
  assets,
  columns,
  virtualizer,
  selectedIds,
  onAssetClick,
  onAssetDoubleClick,
  onDragStart
}: {
  assets: typeof useApp extends () => infer T ? T extends { assets?: infer A } ? A : never : never
  columns: number
  virtualizer: Virtualizer<Element, Element>
  selectedIds: Set<string>
  onAssetClick: (id: string, e: React.MouseEvent) => void
  onAssetDoubleClick: (id: string) => void
  onDragStart: (e: React.DragEvent, asset: { id: string; filename: string; filePath: string }) => void
}) {
  return (
    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const startIdx = virtualRow.index * columns
        const rowItems = assets.slice(startIdx, startIdx + columns)

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: '8px',
              paddingBottom: '4px'
            }}
          >
            {rowItems.map((asset: any, colIdx: number) =>
              asset ? (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  selected={selectedIds.has(asset.id)}
                  onClick={(e) => onAssetClick(asset.id, e)}
                  onDoubleClick={() => onAssetDoubleClick(asset.id)}
                  onDragStart={(e) => onDragStart(e, asset)}
                />
              ) : (
                <div key={`empty-${colIdx}`} />
              )
            )}
          </div>
        )
      })}
    </div>
  )
}

// List View — virtualized rows (thumbnails only mount for visible rows)
function ListContent({
  assets,
  virtualizer,
  selectedIds,
  onAssetClick,
  onAssetDoubleClick,
  onDragStart
}: {
  assets: any[]
  virtualizer: Virtualizer<Element, Element>
  selectedIds: Set<string>
  onAssetClick: (id: string, e: React.MouseEvent) => void
  onAssetDoubleClick: (id: string) => void
  onDragStart: (e: React.DragEvent, asset: { id: string; filename: string; filePath: string }) => void
}) {
  return (
    <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const asset = assets[virtualRow.index]
        if (!asset) return null
        return (
          <div
            key={virtualRow.key}
            className="border-b border-av-border/30"
            data-index={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <AssetListItem
              asset={asset}
              selected={selectedIds.has(asset.id)}
              onClick={(e) => onAssetClick(asset.id, e)}
              onDoubleClick={() => onAssetDoubleClick(asset.id)}
              onDragStart={(e) => onDragStart(e, asset)}
            />
          </div>
        )
      })}
    </div>
  )
}

// Individual Asset Card for Grid View
function AssetCard({
  asset,
  selected,
  onClick,
  onDoubleClick,
  onDragStart
}: {
  asset: any
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const [imgError, setImgError] = React.useState(false)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`group relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all duration-150 ${
        selected
          ? 'ring-2 ring-av-accent-blue shadow-lg shadow-av-accent-blue/20'
          : 'hover:ring-2 hover:ring-av-border-light hover:shadow-md'
      }`}
    >
      {/* Thumbnail or placeholder */}
      <div className="absolute inset-0 bg-av-bg-tertiary">
        {!imgError && (asset.fileType === 'image' || asset.fileType === 'video' || asset.hasThumbnail) ? (
          <ThumbnailImage assetId={asset.id} onError={() => setImgError(true)} />
        ) : (
          <FilePlaceholder fileType={asset.fileType} color={asset.dominantColor} />
        )}

        {/* Selection overlay */}
        {selected && (
          <div className="absolute top-2 left-2 w-5 h-5 rounded bg-av-accent-blue flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
              <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        )}

        {/* Hover overlay - actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-150 flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
          <span className="text-[10px] text-white font-medium truncate max-w-[70%]">
            {asset.filename}
          </span>
          <span className="text-[10px] text-white/80">{formatFileSize(asset.fileSize)}</span>
        </div>
      </div>
    </div>
  )
}

// Thumbnail Image component with lazy loading + cache
const ThumbnailImage = ({ assetId, onError }: { assetId: string; onError: () => void }) => {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.assetVaultAPI.assets
      .getThumbnail(assetId)
      .then((data) => {
        if (!cancelled && data) setSrc(data as string)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [assetId])

  if (!src) return <ThumbnailSkeleton />

  return (
    <img src={src} alt="" className="w-full h-full object-cover" onError={onError} loading="lazy" />
  )
}

function ThumbnailSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center animate-pulse bg-av-bg-hover">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-av-text-muted">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
      </svg>
    </div>
  )
}

// File type placeholder when no thumbnail available
function FilePlaceholder({ fileType, color }: { fileType: string; color?: string | null }) {
  const config: Record<string, { icon: JSX.Element; bgClass: string }> = {
    image: {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
        </svg>
      ),
      bgClass: 'bg-gradient-to-br from-green-900/30 to-emerald-800/20'
    },
    video: {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      ),
      bgClass: 'bg-gradient-to-br from-purple-900/30 to-violet-800/20'
    },
    audio: {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      ),
      bgClass: 'bg-gradient-to-br from-pink-900/30 to-rose-800/20'
    },
    font: {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      ),
      bgClass: 'bg-gradient-to-br from-orange-900/30 to-amber-800/20'
    },
    document: {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
      ),
      bgClass: 'bg-gradient-to-br from-blue-900/30 to-cyan-800/20'
    },
    design: {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      ),
      bgClass: 'bg-gradient-to-br from-fuchsia-900/30 to-pink-800/20'
    },
    '3d': {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
      bgClass: 'bg-gradient-to-br from-slate-700/40 to-slate-900/40'
    },
    code: {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
      ),
      bgClass: 'bg-gradient-to-br from-emerald-900/30 to-teal-800/20'
    }
  }

  const cfg = config[fileType] || config.document
  return (
    <div className={`w-full h-full flex items-center justify-center ${cfg.bgClass}`}>
      <span className="text-av-text-muted">{cfg.icon}</span>
    </div>
  )
}

// Asset list item for list view
function AssetListItem({
  asset,
  selected,
  onClick,
  onDoubleClick,
  onDragStart
}: {
  asset: any
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
        selected ? 'bg-av-accent-blue/10' : 'hover:bg-av-bg-hover'
      }`}
    >
      {/* Mini thumbnail */}
      <div className="w-10 h-10 rounded bg-av-bg-tertiary shrink-0 flex items-center justify-center overflow-hidden">
        {asset.fileType === 'image' || asset.fileType === 'video' || asset.hasThumbnail ? (
          <div className="w-full h-full [&_img]:w-full [&_img]:h-full [&_img]:object-cover">
            <ThumbnailImage assetId={asset.id} onError={() => {}} />
          </div>
        ) : (
          <FilePlaceholder fileType={asset.fileType} color={asset.dominantColor} />
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${selected ? 'text-av-accent-blue' : 'text-av-text-primary'}`}>
          {asset.filename}
        </p>
        <p className="text-xs text-av-text-muted">
          {formatFileSize(asset.fileSize)} · {asset.fileType} ·{' '}
          {new Date(asset.importedAt).toLocaleDateString()}
        </p>
      </div>

      {/* Selection indicator */}
      {selected && (
        <div className="w-4 h-4 rounded-full bg-av-accent-blue flex items-center justify-center shrink-0">
          <svg width="8" height="8" viewBox="0 0 10 10" fill="white">
            <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      )}
    </div>
  )
}

// Empty state component
function EmptyState() {
  const { refreshAssets, startImport, stopImport, currentFolderId } = useApp()

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const paths = resolveDroppedFilePaths(files)
    if (paths.length === 0) return

    const filePaths: string[] = []
    const folderPaths: string[] = []
    for (const p of paths) {
      const kind = await window.assetVaultAPI.fs.pathKind(p)
      if (kind === 'directory') folderPaths.push(p)
      else if (kind === 'file') filePaths.push(p)
    }

    try {
      startImport()
      for (const folder of folderPaths) {
        await window.assetVaultAPI.assets.importFolder(folder)
      }
      if (filePaths.length > 0) {
        await window.assetVaultAPI.assets.import(filePaths, currentFolderId || undefined)
      }
      await refreshAssets()
    } catch (err) {
      console.error('[EmptyState] drop import:', err)
    } finally {
      stopImport()
    }
  }

  return (
    <div
      className="flex-1 flex items-center justify-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-av-bg-secondary border-2 border-dashed border-av-border flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-av-text-muted">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-av-text-primary">No assets yet</h3>
          <p className="text-sm text-av-text-muted mt-1">
            Drag & drop files here, click Import, or press Ctrl+I
          </p>
        </div>
      </div>
    </div>
  )
}

export default AssetGrid
