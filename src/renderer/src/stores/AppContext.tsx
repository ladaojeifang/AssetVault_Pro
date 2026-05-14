import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { AssetItem, FolderItem, TagItem, ViewMode, SortField, QueryParams, QueryResult } from '@/shared/types'

const ASSET_CHUNK_SIZE = 80

interface AppState {
  // View state
  viewMode: ViewMode
  sidebarOpen: boolean
  detailPanelOpen: boolean
  selectedAssetIds: Set<string>
  currentFolderId: string | null

  // Data
  folderTree: FolderItem[]
  assets: AssetItem[]
  totalAssets: number
  /** More rows exist on server beyond `assets.length` */
  hasMoreAssets: boolean
  tags: TagItem[]

  // Filter/Sort state
  searchQuery: string
  fileTypeFilter: string | null
  tagFilters: string[]
  sortField: SortField
  sortOrder: 'asc' | 'desc'

  // Loading states
  isLoading: boolean
  isLoadingMore: boolean
  isImporting: boolean
}

interface AppActions {
  setViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  toggleDetailPanel: () => void
  selectAsset: (id: string) => void
  selectMultiple: (ids: string[]) => void
  clearSelection: () => void
  setCurrentFolder: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setFileTypeFilter: (type: string | null) => void
  setTagFilters: (tags: string[]) => void
  setSorting: (field: SortField, order?: 'asc' | 'desc') => void
  refreshAssets: () => Promise<void>
  /** Load next chunk (infinite scroll). */
  loadMoreAssets: () => void
  refreshFolders: () => Promise<void>
  refreshTags: () => Promise<void>

  // Import
  startImport: () => void
  stopImport: () => void
  setDetailPanelOpen: (open: boolean) => void
}

const defaultState: AppState = {
  viewMode: 'grid',
  sidebarOpen: true,
  detailPanelOpen: false,
  selectedAssetIds: new Set(),
  currentFolderId: null,
  folderTree: [],
  assets: [],
  totalAssets: 0,
  hasMoreAssets: false,
  tags: [],
  searchQuery: '',
  fileTypeFilter: null,
  tagFilters: [],
  sortField: 'importedAt',
  sortOrder: 'desc',
  isLoading: false,
  isLoadingMore: false,
  isImporting: false
}

const AppContext = createContext<(AppState & AppActions) | null>(null)

function buildAssetQuery(
  snapshot: AppState,
  params: Partial<QueryParams> | undefined,
  offset: number
): QueryParams {
  const p = params || {}
  return {
    offset,
    pageSize: ASSET_CHUNK_SIZE,
    search: 'search' in p ? p.search || undefined : snapshot.searchQuery || undefined,
    folderId: 'folderId' in p ? p.folderId || undefined : snapshot.currentFolderId || undefined,
    fileType: 'fileType' in p ? p.fileType || undefined : (snapshot.fileTypeFilter as QueryParams['fileType']) || undefined,
    tags: 'tags' in p ? p.tags : snapshot.tagFilters.length > 0 ? snapshot.tagFilters : undefined,
    sortBy: p.sortBy ?? snapshot.sortField,
    sortOrder: p.sortOrder ?? snapshot.sortOrder
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState)
  const stateRef = useRef(state)
  stateRef.current = state

  const listGenerationRef = useRef(0)

  const fetchAssets = useCallback(async (params?: Partial<QueryParams> & { append?: boolean }) => {
    const append = params?.append === true
    const { append: _appendIgnored, ...queryOverrides } = params || {}
    void _appendIgnored
    const snap = stateRef.current

    if (append) {
      if (!snap.hasMoreAssets || snap.isLoadingMore) return
    } else {
      listGenerationRef.current += 1
    }
    const requestGen = listGenerationRef.current

    setState((prev) => ({
      ...prev,
      isLoading: append ? prev.isLoading : true,
      isLoadingMore: append ? true : false
    }))

    const offset = append ? snap.assets.length : 0
    const queryParams = buildAssetQuery(snap, queryOverrides, offset)

    try {
      const result = (await window.assetVaultAPI.assets.query(queryParams)) as QueryResult<AssetItem>

      if (listGenerationRef.current !== requestGen) return

      const items = result.items as AssetItem[]
      const newLen = offset + items.length

      setState((prev) => ({
        ...prev,
        assets: append ? [...prev.assets, ...items] : items,
        totalAssets: result.total,
        hasMoreAssets: newLen < result.total,
        isLoading: false,
        isLoadingMore: false
      }))
    } catch (error) {
      console.error('Failed to fetch assets:', error)
      if (listGenerationRef.current === requestGen) {
        setState((prev) => ({ ...prev, isLoading: false, isLoadingMore: false }))
      }
    }
  }, [])

  const actions: AppActions = {
    setViewMode: (mode) => setState((prev) => ({ ...prev, viewMode: mode })),
    toggleSidebar: () => setState((prev) => ({ ...prev, sidebarOpen: !prev.sidebarOpen })),
    toggleDetailPanel: () =>
      setState((prev) => ({ ...prev, detailPanelOpen: !prev.detailPanelOpen })),
    selectAsset: (id) =>
      setState((prev) => {
        const newSet = new Set(prev.selectedAssetIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        return { ...prev, selectedAssetIds: newSet }
      }),
    selectMultiple: (ids) =>
      setState((prev) => ({ ...prev, selectedAssetIds: new Set(ids) })),
    clearSelection: () =>
      setState((prev) => ({ ...prev, selectedAssetIds: new Set(), detailPanelOpen: false })),
    setCurrentFolder: async (id) => {
      setState((prev) => ({ ...prev, currentFolderId: id }))
      await fetchAssets({ folderId: id || undefined })
    },
    setSearchQuery: (query) => {
      setState((prev) => ({ ...prev, searchQuery: query }))
      void fetchAssets({ search: query || undefined })
    },
    setFileTypeFilter: (type) => {
      setState((prev) => ({ ...prev, fileTypeFilter: type }))
      void fetchAssets({ fileType: type as QueryParams['fileType'] | undefined })
    },
    setTagFilters: (tags) => {
      setState((prev) => ({ ...prev, tagFilters: tags }))
      void fetchAssets({ tags: tags.length > 0 ? tags : undefined })
    },
    setSorting: (field, order) => {
      const sortOrder =
        order || (field === stateRef.current.sortField && stateRef.current.sortOrder === 'desc' ? 'asc' : 'desc')
      setState((prev) => ({ ...prev, sortField: field, sortOrder }))
      void fetchAssets({ sortBy: field, sortOrder })
    },
    refreshAssets: () => fetchAssets(),
    loadMoreAssets: () => {
      void fetchAssets({ append: true })
    },
    refreshFolders: async () => {
      try {
        const tree = await window.assetVaultAPI.folders.getTree()
        setState((prev) => ({ ...prev, folderTree: tree as FolderItem[] }))
      } catch (error) {
        console.error('Failed to fetch folders:', error)
      }
    },
    refreshTags: async () => {
      try {
        const tagList = await window.assetVaultAPI.tags.list()
        setState((prev) => ({ ...prev, tags: tagList as TagItem[] }))
      } catch (error) {
        console.error('Failed to fetch tags:', error)
      }
    },
    startImport: () => setState((prev) => ({ ...prev, isImporting: true })),
    stopImport: () => setState((prev) => ({ ...prev, isImporting: false })),
    setDetailPanelOpen: (open) => setState((prev) => ({ ...prev, detailPanelOpen: open })),
  }

  return <AppContext.Provider value={{ ...state, ...actions }}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
