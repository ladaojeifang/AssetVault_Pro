import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import type { AssetItem, FolderItem, TagItem, CategoryItem, ViewMode, SortField, QueryParams, QueryResult, ImportProgress } from '@/shared/types'
import type { ColorBucket } from '@/shared/colorBucket'
import type { DatePreset, SizePreset } from '@/shared/assetFilters'
import { SEARCH_DEBOUNCE_MS } from '@/shared/assetFilters'
import { DEFAULT_APP_PREFERENCES } from '@/shared/appPreferences'
import { getActiveSpecialPreview, type SpecialPreviewKind } from '../utils/specialPreview'

const ASSET_CHUNK_SIZE = 80

interface AppState {
  // View state
  viewMode: ViewMode
  sidebarOpen: boolean
  detailPanelOpen: boolean
  selectedAssetIds: Set<string>
  currentFolderId: string | null
  /** Sidebar「收藏」浏览模式 */
  favoritesOnly: boolean
  favoriteCount: number

  // Data
  folderTree: FolderItem[]
  assets: AssetItem[]
  totalAssets: number
  /** More rows exist on server beyond `assets.length` */
  hasMoreAssets: boolean
  tags: TagItem[]
  categories: CategoryItem[]

  // Filter/Sort state
  /** Live search box text */
  searchQuery: string
  /** Applied to API after debounce */
  debouncedSearch: string
  typeFilters: string[]
  tagFilters: string[]
  colorBucketFilter: ColorBucket | null
  sizePresetFilter: SizePreset | null
  fileSizeMinMb: number | null
  fileSizeMaxMb: number | null
  datePresetFilter: DatePreset | null
  extensionFilter: string | null
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
  /** Full-page SVG preview (double-click svg asset) */
  svgPreviewAssetId: string | null
  /** Full-page EXR preview (double-click exr asset) */
  exrPreviewAssetId: string | null
  /** Full-page Markdown editor (double-click .md asset) */
  markdownPreviewAssetId: string | null
}

interface AppActions {
  setViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  toggleDetailPanel: () => void
  selectAsset: (id: string) => void
  selectMultiple: (ids: string[]) => void
  clearSelection: () => void
  setCurrentFolder: (id: string | null) => void
  showAllAssets: () => void
  setFavoritesOnly: (enabled: boolean) => void
  toggleAssetFavorite: (id: string, favorite: boolean) => Promise<void>
  setSearchQuery: (query: string) => void
  setColorBucketFilter: (bucket: ColorBucket | null) => void
  setSizePresetFilter: (preset: SizePreset | null) => void
  setFileSizeMbFilter: (minMb: number | null, maxMb: number | null) => void
  setDatePresetFilter: (preset: DatePreset | null) => void
  setExtensionFilter: (extension: string | null) => void
  clearAssetFilters: () => void
  setTypeFilters: (typeIds: string[]) => void
  toggleTypeFilter: (typeId: string) => void
  setSelectedFontFamilyKey: (key: string | null) => void
  setTagFilters: (tags: string[]) => void
  setSorting: (field: SortField, order?: 'asc' | 'desc') => void
  refreshAssets: () => Promise<void>
  /** Load next chunk (infinite scroll). */
  loadMoreAssets: () => void
  refreshFolders: () => Promise<void>
  refreshTags: () => Promise<void>
  refreshCategories: () => Promise<void>

  // Import
  startImport: () => void
  stopImport: () => void
  setDetailPanelOpen: (open: boolean) => void
  openFontPreview: (assetId: string) => void
  closeFontPreview: () => void
  openModelPreview: (assetId: string) => void
  closeModelPreview: () => void
  openSvgPreview: (assetId: string) => void
  closeSvgPreview: () => void
  openExrPreview: (assetId: string) => void
  closeExrPreview: () => void
  openMarkdownPreview: (assetId: string) => void
  closeMarkdownPreview: () => void
  /** 关闭当前专有预览并返回资源库；无预览时不做任何事 */
  closeActiveSpecialPreview: () => void
  /** Markdown 全页预览注册关闭逻辑（含未保存确认） */
  registerMarkdownPreviewCloser: (fn: (() => void) | null) => void
}

type AppContextValue = AppState &
  AppActions & {
    /** 当前是否处于全页专有预览（字体/3D/SVG/EXR/Markdown） */
    activeSpecialPreview: SpecialPreviewKind | null
  }

const defaultState: AppState = {
  viewMode: 'grid',
  sidebarOpen: true,
  detailPanelOpen: true,
  selectedAssetIds: new Set(),
  currentFolderId: null,
  favoritesOnly: false,
  favoriteCount: 0,
  folderTree: [],
  assets: [],
  totalAssets: 0,
  hasMoreAssets: false,
  tags: [],
  categories: [],
  searchQuery: '',
  debouncedSearch: '',
  typeFilters: [],
  tagFilters: [],
  colorBucketFilter: null,
  sizePresetFilter: null,
  fileSizeMinMb: null,
  fileSizeMaxMb: null,
  datePresetFilter: null,
  extensionFilter: null,
  sortField: 'importedAt',
  sortOrder: 'desc',
  isLoading: false,
  isLoadingMore: false,
  isImporting: false,
  importProgress: null,
  selectedFontFamilyKey: null,
  fontPreviewAssetId: null,
  modelPreviewAssetId: null,
  svgPreviewAssetId: null,
  exrPreviewAssetId: null,
  markdownPreviewAssetId: null
}

const AppContext = createContext<AppContextValue | null>(null)

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
    folderId: snapshot.favoritesOnly
      ? undefined
      : 'folderId' in p
        ? p.folderId || undefined
        : snapshot.currentFolderId || undefined,
    typeFilters:
      'typeFilters' in p
        ? p.typeFilters
        : snapshot.typeFilters.length > 0
          ? snapshot.typeFilters
          : undefined,
    tags: 'tags' in p ? p.tags : snapshot.tagFilters.length > 0 ? snapshot.tagFilters : undefined,
    favoritesOnly:
      'favoritesOnly' in p
        ? p.favoritesOnly || undefined
        : snapshot.favoritesOnly
          ? true
          : undefined,
    colorBucket: 'colorBucket' in p ? p.colorBucket : snapshot.colorBucketFilter || undefined,
    sizePreset: 'sizePreset' in p ? p.sizePreset : snapshot.sizePresetFilter || undefined,
    minFileSizeMb:
      'minFileSizeMb' in p
        ? p.minFileSizeMb
        : !snapshot.sizePresetFilter && snapshot.fileSizeMinMb != null
          ? snapshot.fileSizeMinMb
          : undefined,
    maxFileSizeMb:
      'maxFileSizeMb' in p
        ? p.maxFileSizeMb
        : !snapshot.sizePresetFilter && snapshot.fileSizeMaxMb != null
          ? snapshot.fileSizeMaxMb
          : undefined,
    datePreset: 'datePreset' in p ? p.datePreset : snapshot.datePresetFilter || undefined,
    extension: 'extension' in p ? p.extension : snapshot.extensionFilter || undefined,
    sortBy: p.sortBy ?? snapshot.sortField,
    sortOrder: p.sortOrder ?? snapshot.sortOrder
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState)
  const stateRef = useRef(state)
  stateRef.current = state

  const listGenerationRef = useRef(0)
  const lastFullFetchGenRef = useRef(0)
  const importRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchDebounceGenRef = useRef(0)
  const skipDebouncedSearchFetchRef = useRef(true)
  const markdownPreviewCloseRef = useRef<(() => void) | null>(null)
  const [searchDebounceMs, setSearchDebounceMs] = useState(DEFAULT_APP_PREFERENCES.searchDebounceMs)

  const registerMarkdownPreviewCloser = useCallback((fn: (() => void) | null) => {
    markdownPreviewCloseRef.current = fn
  }, [])

  const closeActiveSpecialPreview = useCallback(() => {
    const prev = stateRef.current
    if (prev.markdownPreviewAssetId) {
      const closer = markdownPreviewCloseRef.current
      if (closer) closer()
      else setState((s) => ({ ...s, markdownPreviewAssetId: null }))
      return
    }
    if (prev.fontPreviewAssetId) {
      setState((s) => ({ ...s, fontPreviewAssetId: null }))
      return
    }
    if (prev.modelPreviewAssetId) {
      setState((s) => ({ ...s, modelPreviewAssetId: null }))
      return
    }
    if (prev.svgPreviewAssetId) {
      setState((s) => ({ ...s, svgPreviewAssetId: null }))
      return
    }
    if (prev.exrPreviewAssetId) {
      setState((s) => ({ ...s, exrPreviewAssetId: null }))
    }
  }, [])

  useEffect(() => {
    void window.assetVaultAPI.settings.getAppPreferences().then((p) => {
      setSearchDebounceMs(p.searchDebounceMs)
    })
    const unsub = window.assetVaultAPI.settings.onAppPreferencesChanged(() => {
      void window.assetVaultAPI.settings.getAppPreferences().then((p) => {
        setSearchDebounceMs(p.searchDebounceMs)
      })
    })
    return unsub
  }, [])

  const loadTagList = useCallback(async () => {
    try {
      const tagList = await window.assetVaultAPI.tags.list()
      setState((prev) => ({ ...prev, tags: tagList as TagItem[] }))
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }, [])

  const loadCategoryList = useCallback(async () => {
    try {
      const categoryList = await window.assetVaultAPI.categories.list()
      setState((prev) => ({ ...prev, categories: categoryList as CategoryItem[] }))
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }, [])

  const loadFavoriteCount = useCallback(async () => {
    try {
      const count = await window.assetVaultAPI.assets.countFavorites()
      setState((prev) => ({ ...prev, favoriteCount: count }))
    } catch (error) {
      console.error('Failed to fetch favorite count:', error)
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
    const appendBaselineGen = append ? lastFullFetchGenRef.current : 0

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
      if (append && lastFullFetchGenRef.current !== appendBaselineGen) return

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
        lastFullFetchGenRef.current = requestGen
        await loadTagList()
        void loadCategoryList()
        void loadFavoriteCount()
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error)
      if (listGenerationRef.current === requestGen) {
        setState((prev) => ({ ...prev, isLoading: false, isLoadingMore: false }))
      }
    }
  }, [loadTagList, loadCategoryList, loadFavoriteCount])

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

  const beginLibrarySwitchClear = useCallback(() => {
    listGenerationRef.current += 1
    setState((prev) => ({
      ...prev,
      selectedAssetIds: new Set(),
      detailPanelOpen: false,
      currentFolderId: null,
      favoritesOnly: false,
      favoriteCount: 0,
      searchQuery: '',
      debouncedSearch: '',
      typeFilters: [],
      tagFilters: [],
      colorBucketFilter: null,
      sizePresetFilter: null,
      fileSizeMinMb: null,
      fileSizeMaxMb: null,
      datePresetFilter: null,
      extensionFilter: null,
      assets: [],
      totalAssets: 0,
      hasMoreAssets: false,
      tags: [],
      categories: [],
      isLoading: true,
      isLoadingMore: false
    }))
  }, [])

  const reloadAfterLibrarySwitch = useCallback(async () => {
    beginLibrarySwitchClear()
    lastFullFetchGenRef.current = listGenerationRef.current
    const gen = listGenerationRef.current
    const sortField = stateRef.current.sortField
    const sortOrder = stateRef.current.sortOrder

    let tree: FolderItem[] = []
    let tagList: TagItem[] = []
    let categoryList: CategoryItem[] = []
    try {
      tree = (await window.assetVaultAPI.folders.getTree()) as FolderItem[]
      tagList = (await window.assetVaultAPI.tags.list()) as TagItem[]
      categoryList = (await window.assetVaultAPI.categories.list()) as CategoryItem[]
    } catch (error) {
      console.error('[App] reload folders/tags/categories after library switch:', error)
    }

    if (listGenerationRef.current !== gen) return

    setState((prev) => ({ ...prev, folderTree: tree, tags: tagList, categories: categoryList }))
    void loadFavoriteCount()

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
  }, [beginLibrarySwitchClear, loadFavoriteCount])

  useEffect(() => {
    const unsubSwitching = window.assetVaultAPI.library.onLibrarySwitching(() => {
      beginLibrarySwitchClear()
    })
    const unsub = window.assetVaultAPI.library.onLibrarySwitched(() => {
      void reloadAfterLibrarySwitch()
    })
    return () => {
      unsubSwitching()
      unsub()
    }
  }, [beginLibrarySwitchClear, reloadAfterLibrarySwitch])

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
    }, searchDebounceMs)
    return () => {
      if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current)
    }
  }, [state.searchQuery, searchDebounceMs])

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
      setState((prev) => ({ ...prev, currentFolderId: id, favoritesOnly: false }))
      await fetchAssets({ folderId: id || undefined, favoritesOnly: undefined })
    },
    showAllAssets: async () => {
      setState((prev) => ({ ...prev, currentFolderId: null, favoritesOnly: false }))
      await fetchAssets({ folderId: undefined, favoritesOnly: undefined })
    },
    setFavoritesOnly: async (enabled) => {
      setState((prev) => ({ ...prev, favoritesOnly: enabled, currentFolderId: null }))
      await fetchAssets({
        favoritesOnly: enabled || undefined,
        folderId: undefined
      })
    },
    toggleAssetFavorite: async (id, favorite) => {
      try {
        const updated = await window.assetVaultAPI.assets.setFavorite(id, favorite)
        if (!updated) return
        setState((prev) => {
          const delta = favorite ? 1 : -1
          const nextCount = Math.max(0, prev.favoriteCount + delta)
          let nextAssets = prev.assets.map((a) =>
            a.id === id ? { ...a, isFavorite: favorite, updatedAt: updated.updatedAt } : a
          )
          if (prev.favoritesOnly && !favorite) {
            nextAssets = nextAssets.filter((a) => a.id !== id)
          }
          return {
            ...prev,
            favoriteCount: nextCount,
            assets: nextAssets,
            totalAssets: prev.favoritesOnly && !favorite ? Math.max(0, prev.totalAssets - 1) : prev.totalAssets
          }
        })
      } catch (error) {
        console.error('Failed to toggle favorite:', error)
      }
    },
    setSearchQuery: (query) => {
      setState((prev) => ({ ...prev, searchQuery: query }))
    },
    setColorBucketFilter: (bucket) => {
      setState((prev) => ({ ...prev, colorBucketFilter: bucket }))
      void fetchAssets({ colorBucket: bucket || undefined })
    },
    setSizePresetFilter: (preset) => {
      setState((prev) => ({
        ...prev,
        sizePresetFilter: preset,
        fileSizeMinMb: preset ? null : prev.fileSizeMinMb,
        fileSizeMaxMb: preset ? null : prev.fileSizeMaxMb
      }))
      void fetchAssets({
        sizePreset: preset || undefined,
        minFileSizeMb: undefined,
        maxFileSizeMb: undefined
      })
    },
    setFileSizeMbFilter: (minMb, maxMb) => {
      const useMb = minMb != null || maxMb != null
      setState((prev) => ({
        ...prev,
        fileSizeMinMb: minMb,
        fileSizeMaxMb: maxMb,
        sizePresetFilter: useMb ? null : prev.sizePresetFilter
      }))
      const overrides: Partial<QueryParams> = {
        minFileSizeMb: minMb ?? undefined,
        maxFileSizeMb: maxMb ?? undefined
      }
      if (useMb) overrides.sizePreset = undefined
      void fetchAssets(overrides)
    },
    setDatePresetFilter: (preset) => {
      setState((prev) => ({ ...prev, datePresetFilter: preset }))
      void fetchAssets({ datePreset: preset || undefined })
    },
    setExtensionFilter: (extension) => {
      setState((prev) => ({ ...prev, extensionFilter: extension }))
      void fetchAssets({ extension: extension || undefined })
    },
    clearAssetFilters: () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current)
        searchDebounceTimerRef.current = null
      }
      skipDebouncedSearchFetchRef.current = true
      const snap = stateRef.current
      const folderId = snap.favoritesOnly ? undefined : snap.currentFolderId || undefined
      const favoritesOnly = snap.favoritesOnly ? true : undefined
      setState((prev) => ({
        ...prev,
        searchQuery: '',
        debouncedSearch: '',
        tagFilters: [],
        typeFilters: [],
        colorBucketFilter: null,
        sizePresetFilter: null,
        fileSizeMinMb: null,
        fileSizeMaxMb: null,
        datePresetFilter: null,
        extensionFilter: null
      }))
      void fetchAssets({
        search: undefined,
        tags: undefined,
        typeFilters: undefined,
        colorBucket: undefined,
        sizePreset: undefined,
        minFileSizeMb: undefined,
        maxFileSizeMb: undefined,
        datePreset: undefined,
        extension: undefined,
        folderId,
        favoritesOnly
      })
    },
    setTypeFilters: (typeIds) => {
      setState((prev) => ({
        ...prev,
        typeFilters: typeIds,
        selectedFontFamilyKey: null,
        selectedAssetIds: typeIds.length > 0 ? new Set<string>() : prev.selectedAssetIds,
        detailPanelOpen: typeIds.length > 0 ? true : prev.detailPanelOpen
      }))
      void fetchAssets({ typeFilters: typeIds.length > 0 ? typeIds : undefined })
    },
    toggleTypeFilter: (typeId) => {
      const prev = stateRef.current.typeFilters
      const next = prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
      setState((s) => ({
        ...s,
        typeFilters: next,
        selectedFontFamilyKey: null,
        selectedAssetIds: next.length > 0 ? new Set<string>() : s.selectedAssetIds,
        detailPanelOpen: next.length > 0 ? true : s.detailPanelOpen
      }))
      void fetchAssets({ typeFilters: next.length > 0 ? next : undefined })
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
    refreshCategories: loadCategoryList,
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
        svgPreviewAssetId: null,
        exrPreviewAssetId: null,
        markdownPreviewAssetId: null,
        selectedAssetIds: new Set([assetId]),
        detailPanelOpen: true
      })),
    closeFontPreview: () => setState((prev) => ({ ...prev, fontPreviewAssetId: null })),
    openModelPreview: (assetId) =>
      setState((prev) => ({
        ...prev,
        modelPreviewAssetId: assetId,
        fontPreviewAssetId: null,
        svgPreviewAssetId: null,
        exrPreviewAssetId: null,
        markdownPreviewAssetId: null,
        selectedAssetIds: new Set([assetId]),
        detailPanelOpen: true
      })),
    closeModelPreview: () => setState((prev) => ({ ...prev, modelPreviewAssetId: null })),
    openSvgPreview: (assetId) =>
      setState((prev) => ({
        ...prev,
        svgPreviewAssetId: assetId,
        fontPreviewAssetId: null,
        modelPreviewAssetId: null,
        exrPreviewAssetId: null,
        markdownPreviewAssetId: null,
        selectedAssetIds: new Set([assetId]),
        detailPanelOpen: true
      })),
    closeSvgPreview: () => setState((prev) => ({ ...prev, svgPreviewAssetId: null })),
    openExrPreview: (assetId) =>
      setState((prev) => ({
        ...prev,
        exrPreviewAssetId: assetId,
        fontPreviewAssetId: null,
        modelPreviewAssetId: null,
        svgPreviewAssetId: null,
        markdownPreviewAssetId: null,
        selectedAssetIds: new Set([assetId]),
        detailPanelOpen: true
      })),
    closeExrPreview: () => setState((prev) => ({ ...prev, exrPreviewAssetId: null })),
    openMarkdownPreview: (assetId) =>
      setState((prev) => ({
        ...prev,
        markdownPreviewAssetId: assetId,
        fontPreviewAssetId: null,
        modelPreviewAssetId: null,
        svgPreviewAssetId: null,
        exrPreviewAssetId: null,
        selectedAssetIds: new Set([assetId]),
        detailPanelOpen: true
      })),
    closeMarkdownPreview: () => setState((prev) => ({ ...prev, markdownPreviewAssetId: null })),
    closeActiveSpecialPreview,
    registerMarkdownPreviewCloser
  }

  const activeSpecialPreview = getActiveSpecialPreview(state)

  return (
    <AppContext.Provider value={{ ...state, ...actions, activeSpecialPreview }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
