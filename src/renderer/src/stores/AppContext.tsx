import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import type { AssetItem, FolderItem, TagItem, ViewMode, SortField, QueryParams, QueryResult, ImportProgress } from '@/shared/types'
import type { ColorBucket } from '@/shared/colorBucket'
import type { DatePreset, SizePreset } from '@/shared/assetFilters'
import { SEARCH_DEBOUNCE_MS } from '@/shared/assetFilters'

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
  /** Live search box text */
  searchQuery: string
  /** Applied to API after debounce */
  debouncedSearch: string
  fileTypeFilter: string | null
  tagFilters: string[]
  colorBucketFilter: ColorBucket | null
  sizePresetFilter: SizePreset | null
  datePresetFilter: DatePreset | null
  sortField: SortField
  sortOrder: 'asc' | 'desc'

  // Loading states
  isLoading: boolean
  isLoadingMore: boolean
  isImporting: boolean
  importProgress: ImportProgress | null

  /** Sidebar 字体族列表当前选中（无单文件选中时显示族详情） */
  selectedFontFamilyKey: string | null
  /** Full-page font preview (double-click font asset) */
  fontPreviewAssetId: string | null
  /** Full-page 3D model preview (double-click 3d asset) */
  modelPreviewAssetId: string | null
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
  setColorBucketFilter: (bucket: ColorBucket | null) => void
  setSizePresetFilter: (preset: SizePreset | null) => void
  setDatePresetFilter: (preset: DatePreset | null) => void
  clearAssetFilters: () => void
  setFileTypeFilter: (type: string | null) => void
  setSelectedFontFamilyKey: (key: string | null) => void
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
  openFontPreview: (assetId: string) => void
  closeFontPreview: () => void
  openModelPreview: (assetId: string) => void
  closeModelPreview: () => void
}

const defaultState: AppState = {
  viewMode: 'grid',
  sidebarOpen: true,
  detailPanelOpen: true,
  selectedAssetIds: new Set(),
  currentFolderId: null,
  folderTree: [],
  assets: [],
  totalAssets: 0,
  hasMoreAssets: false,
  tags: [],
  searchQuery: '',
  debouncedSearch: '',
  fileTypeFilter: null,
  tagFilters: [],
  colorBucketFilter: null,
  sizePresetFilter: null,
  datePresetFilter: null,
  sortField: 'importedAt',
  sortOrder: 'desc',
  isLoading: false,
  isLoadingMore: false,
  isImporting: false,
  importProgress: null,
  selectedFontFamilyKey: null,
  fontPreviewAssetId: null,
  modelPreviewAssetId: null
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
    search: 'search' in p ? p.search || undefined : snapshot.debouncedSearch || undefined,
    folderId: 'folderId' in p ? p.folderId || undefined : snapshot.currentFolderId || undefined,
    fileType: 'fileType' in p ? p.fileType || undefined : (snapshot.fileTypeFilter as QueryParams['fileType']) || undefined,
    tags: 'tags' in p ? p.tags : snapshot.tagFilters.length > 0 ? snapshot.tagFilters : undefined,
    colorBucket: 'colorBucket' in p ? p.colorBucket : snapshot.colorBucketFilter || undefined,
    sizePreset: 'sizePreset' in p ? p.sizePreset : snapshot.sizePresetFilter || undefined,
    datePreset: 'datePreset' in p ? p.datePreset : snapshot.datePresetFilter || undefined,
    sortBy: p.sortBy ?? snapshot.sortField,
    sortOrder: p.sortOrder ?? snapshot.sortOrder
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState)
  const stateRef = useRef(state)
  stateRef.current = state

  const listGenerationRef = useRef(0)
  const importRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchDebounceGenRef = useRef(0)
  const skipDebouncedSearchFetchRef = useRef(true)

  const loadTagList = useCallback(async () => {
    try {
      const tagList = await window.assetVaultAPI.tags.list()
      setState((prev) => ({ ...prev, tags: tagList as TagItem[] }))
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }, [])

  const fetchAssets = useCallback(async (params?: Partial<QueryParams> & { append?: boolean; silent?: boolean }) => {
    const append = params?.append === true
    const silent = params?.silent === true
    const { append: _appendIgnored, silent: _silentIgnored, ...queryOverrides } = params || {}
    void _appendIgnored
    void _silentIgnored
    const snap = stateRef.current

    if (append) {
      if (!snap.hasMoreAssets || snap.isLoadingMore) return
    } else {
      listGenerationRef.current += 1
    }
    const requestGen = listGenerationRef.current

    setState((prev) => ({
      ...prev,
      isLoading: append || silent ? prev.isLoading : true,
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

      if (!append) {
        await loadTagList()
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error)
      if (listGenerationRef.current === requestGen) {
        setState((prev) => ({ ...prev, isLoading: false, isLoadingMore: false }))
      }
    }
  }, [loadTagList])

  const scheduleImportUiRefresh = useCallback(() => {
    if (importRefreshTimerRef.current) clearTimeout(importRefreshTimerRef.current)
    importRefreshTimerRef.current = setTimeout(() => {
      importRefreshTimerRef.current = null
      void fetchAssets({ silent: true })
      void window.assetVaultAPI.folders
        .getTree()
        .then((tree) => {
          setState((prev) => ({ ...prev, folderTree: tree as FolderItem[] }))
        })
        .catch(() => {
          /* ignore */
        })
    }, 200)
  }, [fetchAssets])

  const reloadAfterLibrarySwitch = useCallback(async () => {
    listGenerationRef.current += 1
    const gen = listGenerationRef.current
    const sortField = stateRef.current.sortField
    const sortOrder = stateRef.current.sortOrder

    setState((prev) => ({
      ...prev,
      selectedAssetIds: new Set(),
      detailPanelOpen: false,
      currentFolderId: null,
      searchQuery: '',
      debouncedSearch: '',
      fileTypeFilter: null,
      tagFilters: [],
      colorBucketFilter: null,
      sizePresetFilter: null,
      datePresetFilter: null,
      assets: [],
      totalAssets: 0,
      hasMoreAssets: false,
      isLoading: true,
      isLoadingMore: false
    }))

    let tree: FolderItem[] = []
    let tagList: TagItem[] = []
    try {
      tree = (await window.assetVaultAPI.folders.getTree()) as FolderItem[]
      tagList = (await window.assetVaultAPI.tags.list()) as TagItem[]
    } catch (error) {
      console.error('[App] reload folders/tags after library switch:', error)
    }

    if (listGenerationRef.current !== gen) return

    setState((prev) => ({ ...prev, folderTree: tree, tags: tagList }))

    try {
      const result = (await window.assetVaultAPI.assets.query({
        offset: 0,
        pageSize: ASSET_CHUNK_SIZE,
        sortBy: sortField,
        sortOrder
      })) as QueryResult<AssetItem>

      if (listGenerationRef.current !== gen) return

      const items = result.items as AssetItem[]
      const newLen = items.length
      setState((prev) => ({
        ...prev,
        assets: items,
        totalAssets: result.total,
        hasMoreAssets: newLen < result.total,
        isLoading: false,
        isLoadingMore: false
      }))
    } catch (error) {
      console.error('[App] reload assets after library switch:', error)
      if (listGenerationRef.current === gen) {
        setState((prev) => ({ ...prev, isLoading: false, isLoadingMore: false }))
      }
    }
  }, [])

  useEffect(() => {
    const unsub = window.assetVaultAPI.library.onLibrarySwitched(() => {
      void reloadAfterLibrarySwitch()
    })
    return unsub
  }, [reloadAfterLibrarySwitch])

  useEffect(() => {
    const unsub = window.assetVaultAPI.onAssetsImported(() => {
      scheduleImportUiRefresh()
    })
    return unsub
  }, [scheduleImportUiRefresh])

  useEffect(() => {
    if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current)
    const gen = ++searchDebounceGenRef.current
    searchDebounceTimerRef.current = setTimeout(() => {
      searchDebounceTimerRef.current = null
      if (searchDebounceGenRef.current !== gen) return
      const q = stateRef.current.searchQuery
      setState((prev) => (prev.debouncedSearch === q ? prev : { ...prev, debouncedSearch: q }))
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current)
    }
  }, [state.searchQuery])

  useEffect(() => {
    if (skipDebouncedSearchFetchRef.current) {
      skipDebouncedSearchFetchRef.current = false
      return
    }
    void fetchAssets({ search: state.debouncedSearch || undefined })
  }, [state.debouncedSearch, fetchAssets])

  useEffect(() => {
    const unsub = window.assetVaultAPI.onImportProgress((data) => {
      setState((prev) => ({
        ...prev,
        importProgress: data,
        isImporting: data.status === 'processing' || data.current < data.total
      }))
      if (data.status === 'done') {
        scheduleImportUiRefresh()
      }
      if (data.status === 'done' && data.current >= data.total) {
        setState((prev) => ({
          ...prev,
          isImporting: false,
          importProgress: null
        }))
      }
      if (data.status === 'error' && data.current >= data.total) {
        setState((prev) => ({
          ...prev,
          isImporting: false,
          importProgress: null
        }))
      }
    })
    return unsub
  }, [scheduleImportUiRefresh])

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
      setState((prev) => ({ ...prev, selectedAssetIds: new Set() })),
    setCurrentFolder: async (id) => {
      setState((prev) => ({ ...prev, currentFolderId: id }))
      await fetchAssets({ folderId: id || undefined })
    },
    setSearchQuery: (query) => {
      setState((prev) => ({ ...prev, searchQuery: query }))
    },
    setColorBucketFilter: (bucket) => {
      setState((prev) => ({ ...prev, colorBucketFilter: bucket }))
      void fetchAssets({ colorBucket: bucket || undefined })
    },
    setSizePresetFilter: (preset) => {
      setState((prev) => ({ ...prev, sizePresetFilter: preset }))
      void fetchAssets({ sizePreset: preset || undefined })
    },
    setDatePresetFilter: (preset) => {
      setState((prev) => ({ ...prev, datePresetFilter: preset }))
      void fetchAssets({ datePreset: preset || undefined })
    },
    clearAssetFilters: () => {
      setState((prev) => ({
        ...prev,
        colorBucketFilter: null,
        sizePresetFilter: null,
        datePresetFilter: null
      }))
      void fetchAssets({ colorBucket: undefined, sizePreset: undefined, datePreset: undefined })
    },
    setFileTypeFilter: (type) => {
      setState((prev) => ({
        ...prev,
        fileTypeFilter: type,
        selectedFontFamilyKey: null,
        selectedAssetIds: type ? new Set<string>() : prev.selectedAssetIds,
        detailPanelOpen: type ? true : prev.detailPanelOpen
      }))
      void fetchAssets({ fileType: type as QueryParams['fileType'] | undefined })
    },
    setSelectedFontFamilyKey: (key) =>
      setState((prev) => ({
        ...prev,
        selectedFontFamilyKey: key,
        selectedAssetIds: new Set()
      })),
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
    refreshTags: loadTagList,
    startImport: () =>
      setState((prev) => ({
        ...prev,
        isImporting: true,
        importProgress: null
      })),
    stopImport: () =>
      setState((prev) => ({
        ...prev,
        isImporting: false,
        importProgress: null
      })),
    setDetailPanelOpen: (open) => setState((prev) => ({ ...prev, detailPanelOpen: open })),
    openFontPreview: (assetId) =>
      setState((prev) => ({
        ...prev,
        fontPreviewAssetId: assetId,
        modelPreviewAssetId: null,
        selectedAssetIds: new Set([assetId]),
        detailPanelOpen: true
      })),
    closeFontPreview: () => setState((prev) => ({ ...prev, fontPreviewAssetId: null })),
    openModelPreview: (assetId) =>
      setState((prev) => ({
        ...prev,
        modelPreviewAssetId: assetId,
        fontPreviewAssetId: null,
        selectedAssetIds: new Set([assetId]),
        detailPanelOpen: true
      })),
    closeModelPreview: () => setState((prev) => ({ ...prev, modelPreviewAssetId: null }))
  }

  return <AppContext.Provider value={{ ...state, ...actions }}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
