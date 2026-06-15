import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual'
import { useApp } from '../../stores/AppContext'
import { resolveDropPaths } from '../../utils/resolveDroppedFilePaths'
import type { AssetItem, CategoryItem, FolderItem } from '@/shared/types'
import { formatFileSize } from '@/shared/types'
import { Modal, Input } from '@arco-design/web-react'
import { AssetContextMenu, type AssetContextMenuState } from './AssetContextMenu'
import { getChildFolders, findFolderInTree } from '../../utils/folderTreeNav'
import { FolderIconDisplay } from '../Common/FolderIconDisplay'
import { isAssetDragEvent } from '../../utils/assetDragDrop'
import { addDraggedAssetsToFolder } from '../../utils/addAssetsToFolder'
import { notify } from '../Common/notify'
import { canAssetPreview } from '@/shared/assetPreviewRegistry'
import { shouldRenderThumbnailSlot, usesContainThumbnailFit } from '@/shared/formatCapabilities'
import { performAssetDefaultOpen } from '../../utils/openAssetPreview'
import MasonryGrid from './MasonryGrid'
import { ListViewColumnHeader } from './ListViewColumnHeader'
import { AssetListNoResults } from './AssetListNoResults'
import { useListColumnWidths } from '../../hooks/useListColumnWidths'
import { useListTableLayout } from '../../hooks/useListTableLayout'
import { FileTypePlaceholder } from '../Common/FileTypePlaceholder'
import { FavoriteStarButton } from '../Common/FavoriteStarButton'
import { hasActiveAssetListQuery } from '@/shared/assetFilters'
import type { SortField } from '@/shared/types'

const AssetGrid: React.FC = () => {
  const { t } = useTranslation('assets')
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
    openSvgPreview,
    openExrPreview,
    openMarkdownPreview,
    loadMoreAssets,
    tagFilters,
    typeFilters,
    tags,
    debouncedSearch,
    colorBucketFilter,
    sizePresetFilter,
    fileSizeMinMb,
    fileSizeMaxMb,
    datePresetFilter,
    extensionFilter,
    favoritesOnly,
    currentFolderId,
    refreshAssets,
    refreshFolders,
    refreshCategories,
    folderTree,
    categories,
    setCurrentFolder,
    toggleAssetFavorite,
    sortField,
    sortOrder,
    setSorting,
    setTypeFilters,
    setTagFilters,
    setSizePresetFilter,
    setFileSizeMbFilter,
    setDatePresetFilter,
    setExtensionFilter,
    setColorBucketFilter,
    clearAssetFilters
  } = useApp()

  const handleListSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSorting(field, sortOrder === 'asc' ? 'desc' : 'asc')
      } else {
        const defaultAsc = field === 'filename' || field === 'fileType' || field === 'extension'
        setSorting(field, defaultAsc ? 'asc' : 'desc')
      }
    },
    [sortField, sortOrder, setSorting]
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const listPaneRef = useRef<HTMLDivElement>(null)
  const listHeaderScrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    widths: listColumnWidths,
    onResizePointerDown: onListColumnResize,
    resetColumnWidth: onListColumnReset
  } = useListColumnWidths()

  const {
    stretched: listTableStretched,
    gridTemplateColumns: listGridTemplateColumns,
    minTableWidth: listTableMinWidthPx,
    headerGridClass: listHeaderGridClass,
    rowGridClass: listRowGridClass
  } = useListTableLayout(listPaneRef, listColumnWidths, viewMode === 'list')

  const syncListHeaderScroll = useCallback(() => {
    if (listTableStretched) return
    const header = listHeaderScrollRef.current
    const body = containerRef.current
    if (header && body) header.scrollLeft = body.scrollLeft
  }, [listTableStretched])
  const dragStartRef = useRef<string | null>(null)
  /** Index in current `assets` for Shift+click range selection */
  const anchorIndexRef = useRef<number | null>(null)

  const selectionFilterKey = `${tagFilters.join(',')}|${typeFilters.join(',')}|${favoritesOnly ? 'fav' : ''}|${currentFolderId ?? ''}|${debouncedSearch}|${colorBucketFilter ?? ''}|${sizePresetFilter ?? ''}|${fileSizeMinMb ?? ''}|${fileSizeMaxMb ?? ''}|${datePresetFilter ?? ''}|${extensionFilter ?? ''}`
  useEffect(() => {
    anchorIndexRef.current = null
  }, [selectionFilterKey])

  const childFolders = useMemo(
    () => getChildFolders(folderTree, currentFolderId),
    [folderTree, currentFolderId]
  )

  const showFolderHierarchy =
    !favoritesOnly &&
    !String(debouncedSearch || '').trim() &&
    tagFilters.length === 0 &&
    typeFilters.length === 0 &&
    !colorBucketFilter &&
    !sizePresetFilter &&
    fileSizeMinMb == null &&
    fileSizeMaxMb == null &&
    !datePresetFilter &&
    !extensionFilter
  const showSubfolderStrip = showFolderHierarchy && childFolders.length > 0

  const hasActiveQuery = hasActiveAssetListQuery({
    debouncedSearch,
    tagFilters,
    typeFilters,
    colorBucket: colorBucketFilter,
    sizePreset: sizePresetFilter,
    fileSizeMinMb,
    fileSizeMaxMb,
    datePreset: datePresetFilter,
    extension: extensionFilter
  })

  const listTypeFilter = useMemo((): string | null => {
    if (typeFilters.length !== 1) return null
    return typeFilters[0]!
  }, [typeFilters])

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

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
  const [libraryRoots, setLibraryRoots] = useState<{
    active: string
    recent: string[]
    recentDisplayNames: string[]
  }>({
    active: '',
    recent: [],
    recentDisplayNames: []
  })

  useEffect(() => {
    void window.assetVaultAPI.library.getState().then((s) => {
      setLibraryRoots({ active: s.activeLibraryRoot, recent: s.recentLibraries, recentDisplayNames: s.recentLibraryDisplayNames })
    })
    const unsub = window.assetVaultAPI.library.onLibrarySwitched(() => {
      void window.assetVaultAPI.library.getState().then((s) => {
        setLibraryRoots({ active: s.activeLibraryRoot, recent: s.recentLibraries, recentDisplayNames: s.recentLibraryDisplayNames })
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

  const listAreaEmpty = !isLoading && assets.length === 0

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

  const previewOpeners = useMemo(
    () => ({
      openFontPreview,
      openModelPreview,
      openSvgPreview,
      openExrPreview,
      openMarkdownPreview
    }),
    [openFontPreview, openModelPreview, openSvgPreview, openExrPreview, openMarkdownPreview]
  )

  const handleAssetDoubleClick = useCallback(
    async (id: string) => {
      const asset = assets.find((a) => a.id === id)
      if (!asset) return
      await performAssetDefaultOpen(asset, previewOpeners)
    },
    [assets, previewOpeners]
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
        notify.success(
          t('notify.addedToFolder', {
            count: result.count,
            name: findFolderInTree(folderTree, folderId)?.name ?? t('folder')
          })
        )
        await refreshAssets()
        await refreshFolders()
      } catch (err) {
        console.error('[AssetGrid] drop on folder:', err)
        notify.error(t('notify.addToFolderFailed'))
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
    if (!confirm(t('notify.confirmDelete', { count: toDelete.length }))) return

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
              const name = findFolderInTree(folderTree, extra)?.name ?? t('folder')
              notify.success(t('notify.addedToFolder', { count: assetIds.length, name }))
              await refreshAssets()
              await refreshFolders()
            }
            break
          case 'add-category':
            if (extra) {
              await window.assetVaultAPI.categories.setAssetsType(assetIds, extra)
              const name = categories.find((c) => c.id === extra)?.name ?? t('category')
              notify.success(t('notify.setAssetType', { count: assetIds.length, name }))
              await refreshAssets()
              await refreshCategories()
            }
            break
          case 'add-library':
            if (extra) {
              const r = await window.assetVaultAPI.assets.copyToLibrary(assetIds, extra)
              notify.success(
                t('notify.copiedToLibrary', { copied: r.copied }) +
                  (r.skipped ? t('notify.copiedSkipped', { skipped: r.skipped }) : '')
              )
            }
            break
          case 'set-cover':
            if (currentFolderId && assetIds[0]) {
              await window.assetVaultAPI.folders.setCover(currentFolderId, assetIds[0])
              notify.success(t('notify.setCoverDone'))
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
            if (ok) notify.success(t('notify.filesCopied'))
            else notify.error(t('notify.copyFilesFailed'))
            break
          }
          case 'copy-paths': {
            const n = await window.assetVaultAPI.fs.copyPathsToClipboard(assetIds)
            notify.success(t('notify.pathsCopied', { count: n }))
            break
          }
          case 'analyze-colors': {
            const { updated } = await window.assetVaultAPI.assets.analyzeColorsBatch(assetIds)
            notify.success(t('notify.colorsUpdated', { count: updated }))
            await refreshAssets()
            break
          }
          case 'custom-thumb-file': {
            const paths = await window.assetVaultAPI.fs.selectDialog({
              multi: false,
              filters: [
                {
                  name: 'Images',
                    extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'exr']
                }
              ]
            })
            const source = paths[0]
            if (!source) break
            await window.assetVaultAPI.assets.setCustomThumbnailFile(assetIds[0]!, source)
            notify.success(t('notify.customThumbSet'))
            await refreshAssets()
            break
          }
          case 'custom-thumb-clipboard': {
            await window.assetVaultAPI.assets.setCustomThumbnailFromClipboard(assetIds[0]!)
            notify.success(t('notify.customThumbFromClipboard'))
            await refreshAssets()
            break
          }
          case 'refresh-thumbnail': {
            const { updated } = await window.assetVaultAPI.assets.refreshThumbnail(assetIds)
            notify.success(t('notify.thumbsRefreshed', { updated, total: assetIds.length }))
            await refreshAssets()
            break
          }
          case 'delete':
            await handleDelete(assetIds)
            break
        }
      } catch (err) {
        console.error('[AssetGrid] menu action:', err)
        notify.error(err instanceof Error ? err.message : t('notify.operationFailed'))
      }
    },
    [
      assets,
      childFolders,
      categories,
      currentFolderId,
      folderTree,
      refreshAssets,
      refreshFolders,
      refreshCategories,
      selectedAssetIds
    ]
  )

  const submitRename = useCallback(async () => {
    if (!renameAssetId) return
    const name = renameValue.trim()
    if (!name) {
      notify.warning(t('notify.enterName'))
      return
    }
    setRenameBusy(true)
    try {
      await window.assetVaultAPI.assets.rename(renameAssetId, name)
      setRenameOpen(false)
      notify.success(t('notify.renamed'))
      await refreshAssets()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t('notify.renameFailed'))
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

  const parentNavLabel = favoritesOnly
    ? t('favorites')
    : !currentFolderNode
    ? t('allAssets')
    : currentFolderNode.parentId == null || currentFolderNode.parentId === undefined
      ? t('allAssets')
      : findFolderInTree(folderTree, currentFolderNode.parentId)?.name ?? t('parent')

  if (listAreaEmpty && !hasActiveQuery && !showSubfolderStrip && !favoritesOnly) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {currentFolderId && (showFolderHierarchy || hasActiveQuery) && (
        <div className="px-4 py-2 border-b border-av-border/40 shrink-0">
          <button
            type="button"
            onClick={() => void setCurrentFolder(currentFolderNode?.parentId ?? null)}
            className="text-xs text-av-accent-blue hover:underline"
          >
            {t('backTo', { name: parentNavLabel })}
          </button>
        </div>
      )}

      <div ref={listPaneRef} className="flex flex-col flex-1 min-h-0 min-w-0">
      {viewMode === 'list' && (
        <div
          ref={listHeaderScrollRef}
          className="shrink-0 w-full overflow-x-hidden overflow-y-hidden border-b border-av-border/40 z-10"
        >
          <ListViewColumnHeader
            gridTemplateColumns={listGridTemplateColumns}
            headerGridClass={listHeaderGridClass}
            layoutStretched={listTableStretched}
            tableMinWidth={listTableStretched ? undefined : listTableMinWidthPx}
            onResizeColumn={onListColumnResize}
            onResetColumn={onListColumnReset}
            totalAssets={totalAssets}
            showSectionTitle={showFolderHierarchy}
            contentOpen={!showFolderHierarchy || contentOpen}
            onToggleContent={showFolderHierarchy ? () => setContentOpen((o) => !o) : undefined}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleListSort}
            typeFilter={listTypeFilter}
            typeOptions={categories}
            onTypeFilter={(id) => setTypeFilters(id ? [id] : [])}
            typeFilters={typeFilters}
            tagFilters={tagFilters}
            tags={tags}
            onRemoveTypeFilter={(id) => setTypeFilters(typeFilters.filter((x) => x !== id))}
            onRemoveTagFilter={(id) => setTagFilters(tagFilters.filter((x) => x !== id))}
            onClearFilters={() => clearAssetFilters()}
            sizePresetFilter={sizePresetFilter}
            onSizePreset={setSizePresetFilter}
            fileSizeMinMb={fileSizeMinMb}
            fileSizeMaxMb={fileSizeMaxMb}
            onFileSizeMb={setFileSizeMbFilter}
            datePresetFilter={datePresetFilter}
            onDatePreset={setDatePresetFilter}
            extensionFilter={extensionFilter}
            onExtensionFilter={setExtensionFilter}
            colorBucketFilter={colorBucketFilter}
            onColorBucket={setColorBucketFilter}
          />
        </div>
      )}

      {/* Grid/List + folder hierarchy */}
      <div
        ref={containerRef}
        tabIndex={0}
        onScroll={viewMode === 'list' && !listTableStretched ? syncListHeaderScroll : undefined}
        className={`flex-1 overflow-auto outline-none flex flex-col min-w-0 ${
          viewMode === 'grid' ? 'p-4 gap-3' : 'min-h-0'
        }`}
        style={{
          contain: 'strict'
        }}
      >
        {showFolderHierarchy && showSubfolderStrip && (
          <div
            className={`shrink-0 border-b border-av-border/40 pb-3 ${viewMode === 'list' ? 'px-4 pt-2' : ''}`}
          >
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
              {t('childFolders', { count: childFolders.length })}
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

        {showFolderHierarchy && viewMode === 'grid' && (
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
              {t('contentCount', { count: totalAssets })}
            </button>
          </div>
        )}

        {(!showFolderHierarchy || contentOpen || viewMode === 'list') && (
          <div
            className={
              viewMode === 'list'
                ? `flex flex-col flex-1 min-h-0 py-2 ${listTableStretched ? 'w-full' : ''}`
                : undefined
            }
            style={
              viewMode === 'list' && !listTableStretched
                ? { minWidth: listTableMinWidthPx }
                : undefined
            }
          >
            {assets.length > 0 ? (
              viewMode === 'grid' ? (
                <MasonryGrid
                  assets={assets}
                  scrollElementRef={containerRef}
                  layoutKey={`${subfoldersOpen}-${contentOpen}-${showSubfolderStrip}-${childFolders.length}`}
                  categoryMap={categoryMap}
                  selectedIds={selectedAssetIds}
                  showCaptions={showFolderHierarchy}
                  onAssetClick={handleAssetClick}
                  onAssetDoubleClick={handleAssetDoubleClick}
                  onDragStart={handleDragStart}
                  onAssetContextMenu={handleAssetContextMenu}
                  onToggleFavorite={(id, favorite) => void toggleAssetFavorite(id, favorite)}
                />
              ) : (
                <AssetListVirtualView
                  assets={assets}
                  scrollElementRef={containerRef}
                  gridTemplateColumns={listGridTemplateColumns}
                  rowGridClass={listRowGridClass}
                  selectedIds={selectedAssetIds}
                  onAssetClick={handleAssetClick}
                  onAssetDoubleClick={handleAssetDoubleClick}
                  onDragStart={handleDragStart}
                  onAssetContextMenu={handleAssetContextMenu}
                  onToggleFavorite={(id, favorite) => void toggleAssetFavorite(id, favorite)}
                />
              )
            ) : hasActiveQuery ? (
              <AssetListNoResults
                onClearFilters={() => clearAssetFilters()}
                onBackToParent={
                  currentFolderId
                    ? () => void setCurrentFolder(currentFolderNode?.parentId ?? null)
                    : undefined
                }
                parentLabel={currentFolderId ? parentNavLabel : undefined}
              />
            ) : favoritesOnly ? (
              <div
                className={
                  viewMode === 'list'
                    ? 'flex flex-1 items-center justify-center text-sm text-av-text-muted'
                    : 'py-10 text-center text-sm text-av-text-muted'
                }
              >
                {t('emptyFavorites')}
              </div>
            ) : showFolderHierarchy ? (
              <div
                className={
                  viewMode === 'list'
                    ? 'flex flex-1 items-center justify-center text-sm text-av-text-muted'
                    : 'py-10 text-center text-sm text-av-text-muted'
                }
              >
                {t('emptyFolder')}
              </div>
            ) : null}
          </div>
        )}

        {hasMoreAssets && <div ref={sentinelRef} className="h-8 w-full shrink-0" aria-hidden />}
      </div>
      </div>

      <AssetContextMenu
        state={contextMenu}
        folderTree={folderTree}
        categories={categories}
        currentFolderId={currentFolderId}
        recentLibraries={libraryRoots.recent}
        recentLibraryDisplayNames={libraryRoots.recentDisplayNames}
        activeLibraryRoot={libraryRoots.active}
        onClose={() => setContextMenu(null)}
        onAction={handleAssetMenuAction}
      />

      <Modal
        title={t('renameTitle')}
        visible={renameOpen}
        onOk={() => void submitRename()}
        onCancel={() => setRenameOpen(false)}
        confirmLoading={renameBusy}
        autoFocus={false}
      >
        <Input value={renameValue} onChange={setRenameValue} placeholder={t('renamePlaceholder')} />
      </Modal>
    </div>
  )
}

// List view only — keeps useVirtualizer out of grid mode and avoids flushSync during parent render.
function AssetListVirtualView({
  assets,
  scrollElementRef,
  gridTemplateColumns,
  rowGridClass,
  selectedIds,
  onAssetClick,
  onAssetDoubleClick,
  onDragStart,
  onAssetContextMenu,
  onToggleFavorite
}: {
  assets: AssetItem[]
  scrollElementRef: React.RefObject<HTMLDivElement | null>
  gridTemplateColumns: string
  rowGridClass: string
  selectedIds: Set<string>
  onAssetClick: (id: string, e: React.MouseEvent) => void
  onAssetDoubleClick: (id: string) => void
  onDragStart: (
    e: React.DragEvent,
    asset: { id: string; filename: string; filePath: string; resolvedFilePath?: string }
  ) => void
  onAssetContextMenu: (e: React.MouseEvent, asset: AssetItem) => void
  onToggleFavorite: (id: string, favorite: boolean) => void
}) {
  const listVirtualizer = useVirtualizer<Element, Element>({
    count: assets.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 60,
    overscan: 10,
    useFlushSync: false
  })

  return (
    <ListContent
      assets={assets}
      virtualizer={listVirtualizer}
      gridTemplateColumns={gridTemplateColumns}
      rowGridClass={rowGridClass}
      selectedIds={selectedIds}
      onAssetClick={onAssetClick}
      onAssetDoubleClick={onAssetDoubleClick}
      onDragStart={onDragStart}
      onAssetContextMenu={onAssetContextMenu}
      onToggleFavorite={onToggleFavorite}
    />
  )
}

// List View — virtualized rows (thumbnails only mount for visible rows)
function ListContent({
  assets,
  virtualizer,
  gridTemplateColumns,
  rowGridClass,
  selectedIds,
  onAssetClick,
  onAssetDoubleClick,
  onDragStart,
  onAssetContextMenu,
  onToggleFavorite
}: {
  assets: any[]
  virtualizer: Virtualizer<Element, Element>
  gridTemplateColumns: string
  rowGridClass: string
  selectedIds: Set<string>
  onAssetClick: (id: string, e: React.MouseEvent) => void
  onAssetDoubleClick: (id: string) => void
  onDragStart: (
    e: React.DragEvent,
    asset: { id: string; filename: string; filePath: string; resolvedFilePath?: string }
  ) => void
  onAssetContextMenu: (e: React.MouseEvent, asset: AssetItem) => void
  onToggleFavorite: (id: string, favorite: boolean) => void
}) {
  const { categories } = useApp()
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

  return (
    <div className="relative w-full min-w-0" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((virtualRow: VirtualItem) => {
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
              gridTemplateColumns={gridTemplateColumns}
              rowGridClass={rowGridClass}
              selected={selectedIds.has(asset.id)}
              categoryMap={categoryMap}
              onClick={(e) => onAssetClick(asset.id, e)}
              onDoubleClick={() => onAssetDoubleClick(asset.id)}
              onDragStart={(e) => onDragStart(e, asset)}
              onContextMenu={(e) => onAssetContextMenu(e, asset)}
              onToggleFavorite={onToggleFavorite}
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
  const { t } = useTranslation('assets')
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
              {t('dropToAdd')}
            </span>
          </div>
        )}
        <div className="aspect-[3/4] max-h-52 mx-auto flex items-center justify-center">
          {coverAssetId ? (
            <div className="w-full h-full rounded-lg overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover">
              <ThumbnailImage assetId={coverAssetId} onError={() => {}} />
            </div>
          ) : (
            <div className="w-[60%] h-[60%] flex items-center justify-center" aria-hidden>
              <FolderIconDisplay icon={folder.icon} accentColor={accent} fillContainer />
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-av-text-primary truncate">{folder.name}</p>
      <p className="text-xs text-av-text-muted tabular-nums">
        {t('filesCount', { count: folder.assetCount })}
      </p>
    </div>
  )
}

// Asset list item for list view
function AssetListItem({
  asset,
  gridTemplateColumns,
  rowGridClass,
  selected,
  categoryMap,
  onClick,
  onDoubleClick,
  onDragStart,
  onContextMenu,
  onToggleFavorite
}: {
  asset: AssetItem
  gridTemplateColumns: string
  rowGridClass: string
  selected: boolean
  categoryMap: Map<string, CategoryItem>
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onToggleFavorite: (id: string, favorite: boolean) => void
}) {
  const { t } = useTranslation('assets')
  const can3dPreview = canAssetPreview(asset, 'model')

  const ext = (asset.extension || '').replace(/^\./, '').toLowerCase() || '—'
  const detectedTypeLabel = t(`fileTypes.${asset.fileType}` as 'fileTypes.image', {
    defaultValue: asset.fileType
  })
  const assetType = categoryMap.get(asset.typeId)
  const assetTypeLabel = assetType
    ? assetType.kind === 'system'
      ? t(`fileTypes.${assetType.fileType ?? assetType.name}` as 'fileTypes.image', {
          defaultValue: assetType.name
        })
      : assetType.name
    : detectedTypeLabel
  const assetUserType = assetType?.kind === 'user' ? assetType : undefined

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`${rowGridClass} py-2 cursor-pointer transition-colors ${
        selected ? 'bg-av-accent-blue/10' : 'hover:bg-av-bg-hover'
      }`}
      style={{ gridTemplateColumns }}
    >
      <div className="w-10 h-10 rounded bg-av-bg-tertiary shrink-0 flex items-center justify-center overflow-hidden">
        {shouldRenderThumbnailSlot(asset.extension, asset.hasThumbnail) || can3dPreview ? (
          <div className="w-full h-full [&_img]:w-full [&_img]:h-full">
            <ThumbnailImage
              assetId={asset.id}
              cacheKey={asset.updatedAt.getTime()}
              objectFit={usesContainThumbnailFit(asset.extension) ? 'contain' : 'cover'}
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

      <p
        className={`text-sm truncate min-w-0 ${selected ? 'text-av-accent-blue' : 'text-av-text-primary'}`}
        title={asset.filename}
      >
        {asset.filename}
        {asset.storageMode === 'referenced' && (
          <span
            className={`ml-1.5 text-[9px] font-medium px-1 py-0.5 rounded ${
              asset.sourceMissing
                ? 'bg-av-status-error-muted-bg text-av-status-error-muted-text'
                : 'bg-av-media-overlay-chip text-av-status-warning-muted-text'
            }`}
          >
            {asset.sourceMissing ? t('missing') : t('reference')}
          </span>
        )}
      </p>

      <span className="text-xs text-av-text-muted tabular-nums truncate text-left">
        {formatFileSize(asset.fileSize)}
      </span>
      <span className="text-xs text-av-text-muted truncate text-left min-w-0">
        <span className="block truncate capitalize">{assetTypeLabel}</span>
        {assetUserType ? (
          <span className="inline-flex items-center gap-0.5 max-w-full text-[10px] text-av-text-secondary mt-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: assetUserType.color }}
              aria-hidden
            />
            <span className="truncate">
              {assetUserType.icon ? `${assetUserType.icon} ` : ''}
              {assetUserType.name}
            </span>
          </span>
        ) : null}
      </span>
      <span className="text-xs text-av-text-muted font-mono truncate text-left" title={ext}>
        .{ext}
      </span>
      <span className="text-xs text-av-text-muted tabular-nums truncate text-left">
        {new Date(asset.importedAt).toLocaleDateString()}
      </span>

      <div className="flex justify-end w-full">
        <FavoriteStarButton
          isFavorite={Boolean(asset.isFavorite)}
          onToggle={() => onToggleFavorite(asset.id, !asset.isFavorite)}
          size="sm"
          className={asset.isFavorite ? 'opacity-100' : 'opacity-60 hover:opacity-100'}
        />
      </div>
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
