import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Virtualizer } from '@tanstack/virtual-core'
import { useApp } from '../../stores/AppContext'
import { resolveDropPaths } from '../../utils/resolveDroppedFilePaths'
import { formatFileSize, type AssetItem, type FolderItem } from '@/shared/types'
import { Modal, Input } from '@arco-design/web-react'
import { AssetContextMenu, type AssetContextMenuState } from './AssetContextMenu'
import { getChildFolders, findFolderInTree } from '../../utils/folderTreeNav'
import { FolderIconDisplay } from '../Common/FolderIconDisplay'
import { isAssetDragEvent } from '../../utils/assetDragDrop'
import { addDraggedAssetsToFolder } from '../../utils/addAssetsToFolder'
import { notify } from '../Common/notify'
import { isModel3dPreviewExtension } from '@/shared/model3dFormats'
import MasonryGrid from './MasonryGrid'
import { FileTypePlaceholder } from '../Common/FileTypePlaceholder'

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
    clearSelection,
    setDetailPanelOpen,
    openFontPreview,
    openModelPreview,
    loadMoreAssets,
    tagFilters,
    fileTypeFilter,
    searchQuery,
    currentFolderId,
    refreshAssets,
    refreshFolders,
    folderTree,
    setCurrentFolder
  } = useApp()

  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<string | null>(null)
  /** Index in current `assets` for Shift+click range selection */
  const anchorIndexRef = useRef<number | null>(null)

  const selectionFilterKey = `${tagFilters.join(',')}|${currentFolderId ?? ''}|${searchQuery}|${fileTypeFilter ?? ''}`
  useEffect(() => {
    anchorIndexRef.current = null
  }, [selectionFilterKey])

  const childFolders = useMemo(
    () => getChildFolders(folderTree, currentFolderId),
    [folderTree, currentFolderId]
  )

  const showFolderHierarchy =
    !String(searchQuery || '').trim() && tagFilters.length === 0 && !fileTypeFilter
  const showSubfolderStrip = showFolderHierarchy && childFolders.length > 0

  const currentFolderNode = useMemo(
    () => (currentFolderId ? findFolderInTree(folderTree, currentFolderId) : null),
    [folderTree, currentFolderId]
  )

  const [coverAssetIds, setCoverAssetIds] = useState<Record<string, string>>({})
  const [subfoldersOpen, setSubfoldersOpen] = useState(true)
  const [contentOpen, setContentOpen] = useState(true)
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<AssetContextMenuState>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameAssetId, setRenameAssetId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)
  const [libraryRoots, setLibraryRoots] = useState<{ active: string; recent: string[] }>({
    active: '',
    recent: []
  })

  useEffect(() => {
    void window.assetVaultAPI.library.getState().then((s) => {
      setLibraryRoots({ active: s.activeLibraryRoot, recent: s.recentLibraries })
    })
    const unsub = window.assetVaultAPI.library.onLibrarySwitched(() => {
      void window.assetVaultAPI.library.getState().then((s) => {
        setLibraryRoots({ active: s.activeLibraryRoot, recent: s.recentLibraries })
      })
    })
    return unsub
  }, [])

  useEffect(() => {
    const ids = childFolders.map((c) => c.id)
    if (ids.length === 0) {
      setCoverAssetIds({})
      return
    }
    let cancelled = false
    void window.assetVaultAPI.folders
      .getCoverAssetIds(ids)
      .then((m) => {
        if (!cancelled) setCoverAssetIds(m)
      })
      .catch(() => {
        if (!cancelled) setCoverAssetIds({})
      })
    return () => {
      cancelled = true
    }
  }, [childFolders])

  useEffect(() => {
    setSubfoldersOpen(true)
    setContentOpen(true)
  }, [currentFolderId])

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
      const idx = assets.findIndex((a) => a.id === id)
      if (idx < 0) return

      if (event.shiftKey && anchorIndexRef.current !== null) {
        const from = Math.min(anchorIndexRef.current, idx)
        const to = Math.max(anchorIndexRef.current, idx)
        const ids = assets.slice(from, to + 1).map((a) => a.id)
        selectMultiple(ids)
        return
      }

      if (event.ctrlKey || event.metaKey) {
        selectAsset(id)
        anchorIndexRef.current = idx
        return
      }

      // Plain click on the only selected item → deselect (toggle off)
      if (selectedAssetIds.size === 1 && selectedAssetIds.has(id)) {
        clearSelection()
        anchorIndexRef.current = null
        return
      }

      anchorIndexRef.current = idx
      selectMultiple([id])
      setDetailPanelOpen(true)
    },
    [assets, selectedAssetIds, selectAsset, selectMultiple, clearSelection, setDetailPanelOpen]
  )

  const handleAssetDoubleClick = useCallback(
    async (id: string) => {
      const asset = assets.find((a) => a.id === id)
      if (!asset) return

      if (asset.fileType === 'font') {
        openFontPreview(id)
        return
      }

      if (asset.fileType === '3d' && isModel3dPreviewExtension(asset.extension)) {
        openModelPreview(id)
        return
      }

      const p = asset.resolvedFilePath ?? asset.filePath
      if (p) {
        await window.assetVaultAPI.fs.openInExplorer(p)
      }
    },
    [assets, openFontPreview, openModelPreview]
  )

  const handleDragStart = useCallback(
    (
      e: React.DragEvent,
      asset: { id: string; filename: string; filePath: string; resolvedFilePath?: string }
    ) => {
      dragStartRef.current = asset.id
      e.dataTransfer.effectAllowed = 'copyMove'
      const inSelection = selectedAssetIds.size > 0 && selectedAssetIds.has(asset.id)
      const assetIds = inSelection ? Array.from(selectedAssetIds) : [asset.id]
      const addToFolderOnly = e.altKey
      try {
        e.dataTransfer.setData('text/plain', asset.filename || 'asset')
        e.dataTransfer.setData('application/x-assetvault-asset-id', asset.id)
        e.dataTransfer.setData(
          'application/x-assetvault-drag',
          JSON.stringify({ assetIds, addToFolderOnly })
        )
      } catch {
        // Some platforms restrict custom MIME types during drag
      }
      void window.assetVaultAPI.assetDrag.set(assetIds)
    },
    [selectedAssetIds]
  )

  const handleDragEnd = useCallback(() => {
    dragStartRef.current = null
    void window.assetVaultAPI.assetDrag.clear()
  }, [])

  useEffect(() => {
    window.addEventListener('dragend', handleDragEnd)
    return () => window.removeEventListener('dragend', handleDragEnd)
  }, [handleDragEnd])

  const handleDropOnSubfolder = useCallback(
    async (e: React.DragEvent, folderId: string) => {
      setDropTargetFolderId(null)
      try {
        const result = await addDraggedAssetsToFolder(e, folderId)
        if (!result.ok) return
        notify.success(`已将 ${result.count} 项加入「${findFolderInTree(folderTree, folderId)?.name ?? '文件夹'}」`)
        await refreshAssets()
        await refreshFolders()
      } catch (err) {
        console.error('[AssetGrid] drop on folder:', err)
        notify.error('加入文件夹失败')
      }
    },
    [folderTree, refreshAssets, refreshFolders]
  )

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
      }
    },
    [assets, selectedAssetIds, selectMultiple]
  )

  async function handleDelete(ids?: string[]) {
    const toDelete = ids ?? Array.from(selectedAssetIds)
    if (toDelete.length === 0) return
    if (!confirm(`确定删除 ${toDelete.length} 项？`)) return

    await window.assetVaultAPI.assets.delete(toDelete)
    selectMultiple([])
    await refreshAssets()
    await refreshFolders()
  }

  const handleAssetContextMenu = useCallback(
    (e: React.MouseEvent, asset: AssetItem) => {
      e.preventDefault()
      e.stopPropagation()
      const ids =
        selectedAssetIds.has(asset.id) && selectedAssetIds.size > 0
          ? Array.from(selectedAssetIds)
          : [asset.id]
      const primary = assets.find((a) => a.id === asset.id) ?? asset
      setContextMenu({ assetIds: ids, primaryAsset: primary, x: e.clientX, y: e.clientY })
    },
    [assets, selectedAssetIds]
  )

  const handleAssetMenuAction = useCallback(
    async (key: string, assetIds: string[], extra?: string) => {
      try {
        switch (key) {
          case 'explorer':
            await window.assetVaultAPI.fs.openAssetItemDirectory(assetIds[0]!)
            break
          case 'add-folder':
            if (extra) {
              await window.assetVaultAPI.assets.addToFolders(assetIds, [extra])
              const name = findFolderInTree(folderTree, extra)?.name ?? '文件夹'
              notify.success(`已将 ${assetIds.length} 项加入「${name}」`)
              await refreshAssets()
              await refreshFolders()
            }
            break
          case 'add-library':
            if (extra) {
              const r = await window.assetVaultAPI.assets.copyToLibrary(assetIds, extra)
              notify.success(`已复制 ${r.copied} 项到其它资料库${r.skipped ? `（跳过 ${r.skipped}）` : ''}`)
            }
            break
          case 'set-cover':
            if (currentFolderId && assetIds[0]) {
              await window.assetVaultAPI.folders.setCover(currentFolderId, assetIds[0])
              notify.success('已设为文件夹封面')
              const ids = childFolders.map((c) => c.id)
              if (ids.length) {
                const m = await window.assetVaultAPI.folders.getCoverAssetIds(ids)
                setCoverAssetIds(m)
              }
            }
            break
          case 'rename': {
            const asset = assets.find((a) => a.id === assetIds[0])
            if (!asset) break
            setRenameAssetId(asset.id)
            const base = asset.filename.replace(/\.[^.]+$/, '')
            setRenameValue(base)
            setRenameOpen(true)
            break
          }
          case 'copy-files': {
            const ok = await window.assetVaultAPI.fs.copyFilesToClipboard(assetIds)
            if (ok) notify.success('已复制文件到剪贴板')
            else notify.error('复制文件失败')
            break
          }
          case 'copy-paths': {
            const n = await window.assetVaultAPI.fs.copyPathsToClipboard(assetIds)
            notify.success(`已复制 ${n} 条路径`)
            break
          }
          case 'analyze-colors': {
            const { updated } = await window.assetVaultAPI.assets.analyzeColorsBatch(assetIds)
            notify.success(`已更新 ${updated} 项颜色`)
            await refreshAssets()
            break
          }
          case 'custom-thumb-file': {
            const paths = await window.assetVaultAPI.fs.selectDialog({
              multi: false,
              filters: [
                {
                  name: 'Images',
                  extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif']
                }
              ]
            })
            const source = paths[0]
            if (!source) break
            await window.assetVaultAPI.assets.setCustomThumbnailFile(assetIds[0]!, source)
            notify.success('已设置自定义缩略图')
            await refreshAssets()
            break
          }
          case 'custom-thumb-clipboard': {
            await window.assetVaultAPI.assets.setCustomThumbnailFromClipboard(assetIds[0]!)
            notify.success('已从剪贴板设置自定义缩略图')
            await refreshAssets()
            break
          }
          case 'refresh-thumbnail': {
            const { updated } = await window.assetVaultAPI.assets.refreshThumbnail(assetIds)
            notify.success(`已刷新 ${updated}/${assetIds.length} 个缩略图`)
            await refreshAssets()
            break
          }
          case 'delete':
            await handleDelete(assetIds)
            break
        }
      } catch (err) {
        console.error('[AssetGrid] menu action:', err)
        notify.error(err instanceof Error ? err.message : '操作失败')
      }
    },
    [
      assets,
      childFolders,
      currentFolderId,
      folderTree,
      refreshAssets,
      refreshFolders,
      selectedAssetIds
    ]
  )

  const submitRename = useCallback(async () => {
    if (!renameAssetId) return
    const name = renameValue.trim()
    if (!name) {
      notify.warning('请输入名称')
      return
    }
    setRenameBusy(true)
    try {
      await window.assetVaultAPI.assets.rename(renameAssetId, name)
      setRenameOpen(false)
      notify.success('已重命名')
      await refreshAssets()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : '重命名失败')
    } finally {
      setRenameBusy(false)
    }
  }, [renameAssetId, renameValue, refreshAssets])

  // Keyboard navigation
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('keydown', handleKeyDown as any)
    return () => el.removeEventListener('keydown', handleKeyDown as any)
  }, [handleKeyDown])

  if (isLoading && assets.length === 0 && !showSubfolderStrip) {
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

  const listAreaEmpty = !isLoading && assets.length === 0

  if (listAreaEmpty && !showSubfolderStrip) {
    return (
      <EmptyState />
    )
  }

  const parentNavLabel = !currentFolderNode
    ? '全部资产'
    : currentFolderNode.parentId == null || currentFolderNode.parentId === undefined
      ? '全部资产'
      : findFolderInTree(folderTree, currentFolderNode.parentId)?.name ?? '上级'

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
          {assets.length > 1 && (
            <span className="text-av-text-muted/80 hidden sm:inline">
              {' '}
              · Ctrl/⌘+滚轮缩放 · Ctrl/⌘+单击多选 · Shift+单击范围 · 拖到上方子文件夹加入目录
            </span>
          )}
          {viewMode === 'grid' && assets.length > 0 && (
            <span className="text-av-text-muted/80 hidden md:inline"> · 瀑布流</span>
          )}
        </span>
        {isLoadingMore && <span className="text-xs text-av-accent-blue">Loading more…</span>}
        {isLoading && assets.length > 0 && (
          <span className="text-xs text-av-text-muted">Updating…</span>
        )}
      </div>

      {currentFolderId && showFolderHierarchy && (
        <div className="px-4 py-2 border-b border-av-border/40 shrink-0">
          <button
            type="button"
            onClick={() => void setCurrentFolder(currentFolderNode?.parentId ?? null)}
            className="text-xs text-av-accent-blue hover:underline"
          >
            ← 返回「{parentNavLabel}」
          </button>
        </div>
      )}

      {/* Grid/List + folder hierarchy */}
      <div
        ref={containerRef}
        tabIndex={0}
        className={`flex-1 overflow-auto outline-none flex flex-col ${
          viewMode === 'grid' ? 'p-4 gap-3' : 'px-4 py-2'
        }`}
        style={{
          contain: 'strict'
        }}
      >
        {showFolderHierarchy && showSubfolderStrip && (
          <div className="shrink-0 border-b border-av-border/40 pb-3">
            <button
              type="button"
              className="flex items-center gap-2 w-full text-left text-sm font-medium text-av-text-secondary hover:text-av-text-primary mb-2"
              onClick={() => setSubfoldersOpen((o) => !o)}
            >
              <span
                className={`inline-block w-4 text-[10px] text-av-text-muted transition-transform ${
                  subfoldersOpen ? '' : '-rotate-90'
                }`}
              >
                ▼
              </span>
              子文件夹 ({childFolders.length})
            </button>
            {subfoldersOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {childFolders.map((f) => (
                  <FolderBrowseCard
                    key={f.id}
                    folder={f}
                    coverAssetId={coverAssetIds[f.id]}
                    isDropTarget={dropTargetFolderId === f.id}
                    onOpen={() => void setCurrentFolder(f.id)}
                    onAssetDragOver={(e) => {
                      if (!isAssetDragEvent(e)) return
                      e.preventDefault()
                      e.stopPropagation()
                      e.dataTransfer.dropEffect = 'copy'
                      setDropTargetFolderId(f.id)
                    }}
                    onAssetDragLeave={() => {
                      setDropTargetFolderId((prev) => (prev === f.id ? null : prev))
                    }}
                    onAssetDrop={(e) => void handleDropOnSubfolder(e, f.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {showFolderHierarchy && (
          <div className="shrink-0 border-b border-av-border/30 pb-2">
            <button
              type="button"
              className="flex items-center gap-2 w-full text-left text-sm font-medium text-av-text-secondary hover:text-av-text-primary"
              onClick={() => setContentOpen((o) => !o)}
            >
              <span
                className={`inline-block w-4 text-[10px] text-av-text-muted transition-transform ${
                  contentOpen ? '' : '-rotate-90'
                }`}
              >
                ▼
              </span>
              内容 ({totalAssets})
            </button>
          </div>
        )}

        {(!showFolderHierarchy || contentOpen) && (
          <>
            {assets.length > 0 ? (
              viewMode === 'grid' ? (
                <MasonryGrid
                  assets={assets}
                  scrollElementRef={containerRef}
                  layoutKey={`${subfoldersOpen}-${contentOpen}-${showSubfolderStrip}-${childFolders.length}`}
                  selectedIds={selectedAssetIds}
                  showCaptions={showFolderHierarchy}
                  onAssetClick={handleAssetClick}
                  onAssetDoubleClick={handleAssetDoubleClick}
                  onDragStart={handleDragStart}
                  onAssetContextMenu={handleAssetContextMenu}
                />
              ) : (
                <ListContent
                  assets={assets}
                  virtualizer={listVirtualizer}
                  selectedIds={selectedAssetIds}
                  onAssetClick={handleAssetClick}
                  onAssetDoubleClick={handleAssetDoubleClick}
                  onDragStart={handleDragStart}
                  onAssetContextMenu={handleAssetContextMenu}
                />
              )
            ) : showFolderHierarchy ? (
              <div className="py-10 text-center text-sm text-av-text-muted">此位置暂无素材文件</div>
            ) : null}
          </>
        )}

        {hasMoreAssets && <div ref={sentinelRef} className="h-8 w-full shrink-0" aria-hidden />}
      </div>

      <AssetContextMenu
        state={contextMenu}
        folderTree={folderTree}
        currentFolderId={currentFolderId}
        recentLibraries={libraryRoots.recent}
        activeLibraryRoot={libraryRoots.active}
        onClose={() => setContextMenu(null)}
        onAction={handleAssetMenuAction}
      />

      <Modal
        title="重命名"
        visible={renameOpen}
        onOk={() => void submitRename()}
        onCancel={() => setRenameOpen(false)}
        confirmLoading={renameBusy}
        autoFocus={false}
      >
        <Input value={renameValue} onChange={setRenameValue} placeholder="文件名（不含扩展名）" />
      </Modal>
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
  onDragStart,
  onAssetContextMenu
}: {
  assets: any[]
  virtualizer: Virtualizer<Element, Element>
  selectedIds: Set<string>
  onAssetClick: (id: string, e: React.MouseEvent) => void
  onAssetDoubleClick: (id: string) => void
  onDragStart: (
    e: React.DragEvent,
    asset: { id: string; filename: string; filePath: string; resolvedFilePath?: string }
  ) => void
  onAssetContextMenu: (e: React.MouseEvent, asset: AssetItem) => void
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
              onContextMenu={(e) => onAssetContextMenu(e, asset)}
            />
          </div>
        )
      })}
    </div>
  )
}

// Thumbnail Image component with lazy loading + cache
const ThumbnailImage = ({
  assetId,
  cacheKey,
  objectFit = 'cover',
  retryWhileEmpty = false,
  onError
}: {
  assetId: string
  cacheKey?: string | number
  objectFit?: 'cover' | 'contain'
  /** For 3D: poll while thumbnail is generating asynchronously. */
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

  if (!src) return <ThumbnailSkeleton />

  return (
    <img
      src={src}
      alt=""
      className={`w-full h-full ${objectFit === 'contain' ? 'object-contain' : 'object-cover'}`}
      onError={onError}
      loading="lazy"
    />
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

function FolderBrowseCard({
  folder,
  coverAssetId,
  isDropTarget,
  onOpen,
  onAssetDragOver,
  onAssetDragLeave,
  onAssetDrop
}: {
  folder: FolderItem
  coverAssetId?: string
  isDropTarget?: boolean
  onOpen: () => void
  onAssetDragOver?: (e: React.DragEvent) => void
  onAssetDragLeave?: () => void
  onAssetDrop?: (e: React.DragEvent) => void
}) {
  const accent = folder.color ?? '#64748b'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      onDragOver={onAssetDragOver}
      onDragLeave={onAssetDragLeave}
      onDrop={onAssetDrop}
      className={`text-left group w-full cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-av-accent-blue/60 transition-all ${
        isDropTarget ? 'ring-2 ring-av-accent-blue shadow-lg shadow-av-accent-blue/25 scale-[1.02]' : ''
      }`}
    >
      <div
        className="relative rounded-xl overflow-hidden bg-av-bg-tertiary border shadow-md transition-transform group-hover:scale-[1.01] active:scale-[0.99]"
        style={{ borderColor: isDropTarget ? accent : `${accent}66` }}
      >
        {isDropTarget && (
          <div className="absolute inset-0 z-[2] bg-av-accent-blue/15 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-medium text-av-accent-blue px-2 py-1 rounded-md bg-av-bg-primary/80">
              松开加入
            </span>
          </div>
        )}
        <div className="absolute top-2 left-3 right-3 space-y-1 z-[1] pointer-events-none">
          <div className="h-0.5 rounded-full bg-av-border" />
          <div className="h-0.5 rounded-full bg-av-border/70 w-[92%]" />
        </div>
        <div className="aspect-[3/4] max-h-52 mx-auto flex items-center justify-center pt-7 px-2 pb-2">
          {coverAssetId ? (
            <div className="w-full h-full rounded-lg overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover">
              <ThumbnailImage assetId={coverAssetId} onError={() => {}} />
            </div>
          ) : (
            <div className="opacity-80 flex items-center justify-center" aria-hidden>
              <FolderIconDisplay icon={folder.icon} fallbackEmoji="📁" size={44} />
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-av-text-primary truncate">{folder.name}</p>
      <p className="text-xs text-av-text-muted tabular-nums">{folder.assetCount} 个文件</p>
    </div>
  )
}

// Asset list item for list view
function AssetListItem({
  asset,
  selected,
  onClick,
  onDoubleClick,
  onDragStart,
  onContextMenu
}: {
  asset: any
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const can3dPreview = asset.fileType === '3d' && isModel3dPreviewExtension(asset.extension)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
        selected ? 'bg-av-accent-blue/10' : 'hover:bg-av-bg-hover'
      }`}
    >
      {/* Mini thumbnail */}
      <div className="w-10 h-10 rounded bg-av-bg-tertiary shrink-0 flex items-center justify-center overflow-hidden">
        {asset.fileType === 'image' || asset.fileType === 'video' || asset.fileType === 'font' || can3dPreview || asset.hasThumbnail ? (
          <div className="w-full h-full [&_img]:w-full [&_img]:h-full">
            <ThumbnailImage
              assetId={asset.id}
              cacheKey={asset.updatedAt}
              objectFit={asset.fileType === 'font' ? 'contain' : 'cover'}
              retryWhileEmpty={can3dPreview && !asset.hasThumbnail}
              onError={() => {}}
            />
          </div>
        ) : (
          <FileTypePlaceholder
            fileType={asset.fileType}
            extension={asset.extension}
            color={asset.dominantColor}
            size="sm"
          />
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
    const paths = resolveDropPaths(e.dataTransfer)
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
