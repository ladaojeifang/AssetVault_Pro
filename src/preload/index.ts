import { contextBridge, ipcRenderer, webUtils } from 'electron'

// Basic electron API (replaces @electron-toolkit/preload)
const electronAPI = {
  process: {
    platform: process.platform,
    arch: process.arch
  },
  ipcRenderer: {
    on: (channel: string, callback: (...args: unknown[]) => void) =>
      ipcRenderer.on(channel, (_event, ...args) => callback(...args)),
    once: (channel: string, callback: (...args: unknown[]) => void) =>
      ipcRenderer.once(channel, (_event, ...args) => callback(...args)),
    send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    removeListener: (channel: string, listener: (...args: unknown[]) => void) =>
      ipcRenderer.removeListener(channel, listener as any),
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
  }
}

// API definitions for contextBridge
const api = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    openAiCanvas: (canvasId?: string | null) =>
      ipcRenderer.invoke('window:open-ai-canvas', canvasId ?? null) as Promise<boolean>,
    focusMain: () => ipcRenderer.invoke('window:focus-main') as Promise<boolean>,
    getRole: () => ipcRenderer.invoke('window:get-role') as Promise<'main' | 'ai-canvas' | 'unknown'>
  },

  assetDrag: {
    set: (assetIds: string[]) => ipcRenderer.invoke('assetDrag:set', assetIds) as Promise<boolean>,
    clear: () => ipcRenderer.invoke('assetDrag:clear') as Promise<boolean>,
    isActive: () => ipcRenderer.invoke('assetDrag:is-active') as Promise<boolean>,
    consume: () => ipcRenderer.invoke('assetDrag:consume') as Promise<string[] | null>,
    onStateChange: (
      callback: (state: { active: boolean; assetIds: string[] }) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        state: { active: boolean; assetIds: string[] }
      ) => callback(state)
      ipcRenderer.on('asset-drag:state', handler)
      return () => ipcRenderer.removeListener('asset-drag:state', handler)
    },
    onNavigate: (callback: (payload: { canvasId: string | null }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { canvasId: string | null }
      ) => callback(payload)
      ipcRenderer.on('ai-canvas:navigate', handler)
      return () => ipcRenderer.removeListener('ai-canvas:navigate', handler)
    }
  },

  // Folder operations
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    getTree: () => ipcRenderer.invoke('folders:get-tree'),
    create: (data: { name: string; parentId?: string; color?: string; icon?: string | null }) =>
      ipcRenderer.invoke('folders:create', data),
    update: (id: string, data: { name?: string; parentId?: string; color?: string; icon?: string | null }) =>
      ipcRenderer.invoke('folders:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('folders:delete', id),
    move: (id: string, newParentId: string) =>
      ipcRenderer.invoke('folders:move', id, newParentId),
    getCoverAssetIds: (folderIds: string[]) =>
      ipcRenderer.invoke('folders:get-cover-asset-ids', folderIds) as Promise<Record<string, string>>,
    importIconFromFile: (sourcePath: string) =>
      ipcRenderer.invoke('folders:import-icon-from-file', sourcePath) as Promise<{
        relativePath: string
        previewDataUrl: string
      }>,
    getIconDataUrl: (relativePath: string) =>
      ipcRenderer.invoke('folders:get-icon-data-url', relativePath) as Promise<string | null>,
    deleteStoredIcon: (relativePath: string) =>
      ipcRenderer.invoke('folders:delete-stored-icon', relativePath) as Promise<boolean>,
    setCover: (folderId: string, assetId: string) =>
      ipcRenderer.invoke('folders:set-cover', folderId, assetId) as Promise<boolean>
  },

  // Asset operations
  assets: {
    query: (params: {
      offset?: number
      page?: number
      pageSize?: number
      search?: string
      folderId?: string
      fileType?: string
      tags?: string[]
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    }) => ipcRenderer.invoke('assets:query', params),
    getById: (id: string) => ipcRenderer.invoke('assets:get-by-id', id),
    import: (
      filePaths: string[],
      options?: string | import('../../shared/importTypes').ImportAssetOptions
    ) => ipcRenderer.invoke('assets:import', filePaths, options),
    importFolder: (
      folderPath: string,
      options?: string | import('../../shared/importTypes').ImportAssetOptions
    ) => ipcRenderer.invoke('assets:import-folder', folderPath, options),
    scanContentHashes: () =>
      ipcRenderer.invoke('assets:scan-content-hashes') as Promise<import('../../shared/importTypes').ContentHashScanResult>,
    regenerateFontThumbnails: () =>
      ipcRenderer.invoke('assets:regenerate-font-thumbnails') as Promise<
        import('../../shared/fontTypes').FontRegenerateResult
      >,
    regenerateModelThumbnails: () =>
      ipcRenderer.invoke('assets:regenerate-model-thumbnails') as Promise<
        import('../../shared/model3dFormats').ModelRegenerateResult
      >,
    regenerateEmbeddedDccThumbnails: () =>
      ipcRenderer.invoke('assets:regenerate-embedded-dcc-thumbnails') as Promise<
        import('../../shared/embeddedDccFormats').EmbeddedDccRegenerateResult
      >,
    regenerateTextPreviewThumbnails: () =>
      ipcRenderer.invoke('assets:regenerate-text-preview-thumbnails') as Promise<
        import('../../shared/textPreviewFormats').TextPreviewRegenerateResult
      >,
    delete: (ids: string[]) => ipcRenderer.invoke('assets:delete', ids),
    move: (ids: string[], targetFolderId: string) =>
      ipcRenderer.invoke('assets:move', ids, targetFolderId),
    addToFolders: (assetIds: string[], folderIds: string[]) =>
      ipcRenderer.invoke('assets:add-to-folders', assetIds, folderIds),
    removeFromFolders: (assetIds: string[], folderIds: string[]) =>
      ipcRenderer.invoke('assets:remove-from-folders', assetIds, folderIds),
    updateMetadata: (id: string, metadata: Record<string, unknown>) =>
      ipcRenderer.invoke('assets:update-metadata', id, metadata),
    updateNotes: (id: string, notes: string) => ipcRenderer.invoke('assets:update-notes', id, notes),
    updateSourceUrl: (id: string, url: string | null) =>
      ipcRenderer.invoke('assets:update-source-url', id, url) as Promise<boolean>,
    getThumbnail: (id: string) => ipcRenderer.invoke('assets:get-thumbnail', id),
    setCustomThumbnailFile: (id: string, sourcePath: string) =>
      ipcRenderer.invoke('assets:set-custom-thumbnail-file', id, sourcePath) as Promise<{ ok: true }>,
    setCustomThumbnailFromClipboard: (id: string) =>
      ipcRenderer.invoke('assets:set-custom-thumbnail-clipboard', id) as Promise<{ ok: true }>,
    refreshThumbnail: (ids: string[]) =>
      ipcRenderer.invoke('assets:refresh-thumbnail', ids) as Promise<{ updated: number; total: number }>,
    analyzeColors: (id: string) => ipcRenderer.invoke('assets:analyze-colors', id),
    rename: (id: string, newName: string) =>
      ipcRenderer.invoke('assets:rename', id, newName) as Promise<{ filename: string }>,
    analyzeColorsBatch: (ids: string[]) =>
      ipcRenderer.invoke('assets:analyze-colors-batch', ids) as Promise<{ updated: number }>,
    copyToLibrary: (assetIds: string[], targetLibraryRoot: string) =>
      ipcRenderer.invoke('assets:copy-to-library', assetIds, targetLibraryRoot) as Promise<{
        copied: number
        skipped: number
      }>,
    localize: (assetIds: string[]) =>
      ipcRenderer.invoke('assets:localize', assetIds) as Promise<
        import('../../shared/libraryTypes').LocalizeAssetsResult
      >,
    relink: (assetId: string, newPath: string) =>
      ipcRenderer.invoke('assets:relink', assetId, newPath) as Promise<
        { ok: true } | { ok: false; error: string }
      >
  },

  library: {
    getInfo: () =>
      ipcRenderer.invoke('library:get-info') as Promise<{
        libraryRoot: string
        manifestPath: string
        dbPath: string
        libraryMode: import('../../shared/libraryTypes').LibraryMode
        localization: import('../../shared/libraryTypes').LibraryLocalizationManifest | null
        stats: import('../../shared/libraryTypes').LibraryModeStats
      }>,
    getState: () =>
      ipcRenderer.invoke('library:get-state') as Promise<
        import('../../shared/webApiTypes').LibraryStateResponse
      >,
    getModeStats: () =>
      ipcRenderer.invoke('library:get-mode-stats') as Promise<
        import('../../shared/libraryTypes').LibraryModeStats
      >,
    switchRoot: (targetRoot: string) => ipcRenderer.invoke('library:switch', targetRoot),
    pickAndSwitch: () => ipcRenderer.invoke('library:pick-and-switch'),
    createAndSwitch: (libraryMode?: import('../../shared/libraryTypes').LibraryMode) =>
      ipcRenderer.invoke('library:create-and-switch', libraryMode ?? 'archive'),
    createEmbedded: () =>
      ipcRenderer.invoke('library:create-embedded') as Promise<
        import('../../shared/libraryTypes').CreateEmbeddedLibraryResult
      >,
    upgradeToArchive: (options?: { preferHardlink?: boolean }) =>
      ipcRenderer.invoke('library:upgrade-to-archive', options) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    verifySources: () =>
      ipcRenderer.invoke('library:verify-sources') as Promise<{ checked: number; missing: number }>,
    pickSourceLibraryRoot: () =>
      ipcRenderer.invoke('library:pick-source-library-root') as Promise<
        { ok: true; path: string } | { ok: false; error: string }
      >,
    importFromLibrary: (sourceLibraryRoot: string) =>
      ipcRenderer.invoke('library:import-from-library', sourceLibraryRoot) as Promise<
        import('../../shared/libraryTypes').ImportLibraryResult
      >,
    removeFromRecent: (path: string) => ipcRenderer.invoke('library:remove-from-recent', path),
    getStorageStats: () =>
      ipcRenderer.invoke('library:get-storage-stats') as Promise<{
        assetRowCount: number
        itemPackCount: number
        itemsDir: string
      }>,
    onLibrarySwitched: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('library:switched', handler)
      return () => ipcRenderer.removeListener('library:switched', handler)
    },
    onUpgradeProgress: (callback: (data: import('../../shared/libraryTypes').UpgradeLibraryProgress) => void) => {
      const handler = (_: unknown, data: import('../../shared/libraryTypes').UpgradeLibraryProgress) =>
        callback(data)
      ipcRenderer.on('library:upgrade-progress', handler)
      return () => ipcRenderer.removeListener('library:upgrade-progress', handler)
    },
    onImportProgress: (callback: (data: import('../../shared/libraryTypes').ImportLibraryProgress) => void) => {
      const handler = (_: unknown, data: import('../../shared/libraryTypes').ImportLibraryProgress) =>
        callback(data)
      ipcRenderer.on('library:import-progress', handler)
      return () => ipcRenderer.removeListener('library:import-progress', handler)
    },
    onEmbeddedImportProgress: (callback: (data: import('../../shared/libraryTypes').EmbeddedImportProgress) => void) => {
      const handler = (_: unknown, data: import('../../shared/libraryTypes').EmbeddedImportProgress) =>
        callback(data)
      ipcRenderer.on('embedded-import:progress', handler)
      return () => ipcRenderer.removeListener('embedded-import:progress', handler)
    }
  },

  exr: {
    getMetadata: (assetId: string) =>
      ipcRenderer.invoke('exr:get-metadata', assetId) as Promise<
        | { ok: true; metadata: import('../../shared/exrTypes').ExrFileMetadata }
        | { ok: false; error: string }
      >,
    renderPreview: (req: import('../../shared/exrTypes').ExrPreviewRenderRequest) =>
      ipcRenderer.invoke('exr:render-preview', req) as Promise<
        import('../../shared/exrTypes').ExrPreviewRenderResult
      >
  },

  fonts: {
    getSettings: () =>
      ipcRenderer.invoke('fonts:get-settings') as Promise<import('../../shared/fontSettings').FontAppSettings>,
    setSettings: (settings: import('../../shared/fontSettings').FontAppSettings) =>
      ipcRenderer.invoke('fonts:set-settings', settings),
    getEffectiveSampleText: () =>
      ipcRenderer.invoke('fonts:get-effective-sample-text') as Promise<{
        sampleText: string
        sampleVersion: number
      }>,
    listFaces: (assetId: string) =>
      ipcRenderer.invoke('fonts:list-faces', assetId) as Promise<
        import('../../shared/fontTypes').FontFaceSummary[]
      >,
    renderPreview: (req: import('../../shared/fontTypes').FontPreviewRenderRequest) =>
      ipcRenderer.invoke('fonts:render-preview', req) as Promise<
        { ok: true; dataUrl: string } | { ok: false; error: string }
      >,
    updateFaceIndex: (assetId: string, ttcIndex: number, reparse?: boolean) =>
      ipcRenderer.invoke('fonts:update-face-index', assetId, ttcIndex, reparse) as Promise<
        { ok: true; font: import('../../shared/fontTypes').ParsedFontMetadata | null } | { ok: false; error: string }
      >,
    listFamilyGroups: () =>
      ipcRenderer.invoke('fonts:list-family-groups') as Promise<
        import('../../shared/fontTypes').FontFamilyGroup[]
      >,
    installToSystem: (assetId: string) =>
      ipcRenderer.invoke('fonts:install-to-system', assetId) as Promise<
        { ok: true; dest?: string } | { ok: false; error: string }
      >,
    exportCopy: (assetId: string) =>
      ipcRenderer.invoke('fonts:export-copy', assetId) as Promise<
        { ok: true; path: string } | { ok: false; error: string }
      >,
    openPreviewWindow: (assetId: string) =>
      ipcRenderer.invoke('fonts:open-preview-window', assetId) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    openItemFolder: (assetId: string) =>
      ipcRenderer.invoke('fonts:open-item-folder', assetId) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    onOpenPreview: (callback: (payload: { assetId: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { assetId: string }) =>
        callback(payload)
      ipcRenderer.on('fonts:open-preview', handler)
      return () => ipcRenderer.removeListener('fonts:open-preview', handler)
    }
  },

  settings: {
    getAppPreferences: () =>
      ipcRenderer.invoke('settings:get-app-preferences') as Promise<
        import('../../shared/appPreferences').AppPreferences
      >,
    setAppPreferences: (prefs: import('../../shared/appPreferences').AppPreferences) =>
      ipcRenderer.invoke('settings:set-app-preferences', prefs) as Promise<
        import('../../shared/appPreferences').AppPreferences
      >,
    onAppPreferencesChanged: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('settings:app-preferences-changed', handler)
      return () => ipcRenderer.removeListener('settings:app-preferences-changed', handler)
    },
    getAppAppearance: () =>
      ipcRenderer.invoke('settings:get-app-appearance') as Promise<
        import('../../shared/appTheme').AppAppearanceSettings
      >,
    setAppTheme: (theme: import('../../shared/appTheme').AppTheme) =>
      ipcRenderer.invoke('settings:set-app-theme', theme) as Promise<
        import('../../shared/appTheme').AppAppearanceSettings
      >,
    onAppAppearanceChanged: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('settings:app-appearance-changed', handler)
      return () => ipcRenderer.removeListener('settings:app-appearance-changed', handler)
    },
    getFormatIconOverrides: () =>
      ipcRenderer.invoke('settings:get-format-icon-overrides') as Promise<
        import('../../shared/formatIconOverrides').FormatIconOverridesSettings
      >,
    setFormatIconOverrides: (
      settings: import('../../shared/formatIconOverrides').FormatIconOverridesSettings
    ) =>
      ipcRenderer.invoke('settings:set-format-icon-overrides', settings) as Promise<
        import('../../shared/formatIconOverrides').FormatIconOverridesSettings
      >,
    importFormatIconImage: (extension: string, sourcePath: string) =>
      ipcRenderer.invoke('settings:import-format-icon-image', extension, sourcePath) as Promise<{
        path: string
      }>,
    onFormatIconOverridesChanged: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('settings:format-icon-overrides-changed', handler)
      return () => ipcRenderer.removeListener('settings:format-icon-overrides-changed', handler)
    },
    getWebApiStatus: () =>
      ipcRenderer.invoke('settings:get-web-api-status') as Promise<{
        running: boolean
        enabled: boolean
        baseUrl: string
        playgroundUrl: string
        openApiUrl: string
        port: number
        bind: string
        allowRemote: boolean
        token: string
      }>,
    regenerateWebApiToken: () =>
      ipcRenderer.invoke('settings:regenerate-web-api-token') as Promise<{
        running: boolean
        enabled: boolean
        baseUrl: string
        playgroundUrl: string
        openApiUrl: string
        port: number
        bind: string
        allowRemote: boolean
        token: string
      }>,
    openWebApiPlayground: (url: string) =>
      ipcRenderer.invoke('settings:open-web-api-playground', url) as Promise<boolean>
  },

  // Tag operations
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    create: (data: { name: string; color?: string; description?: string }) =>
      ipcRenderer.invoke('tags:create', data),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('tags:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('tags:delete', id),
    assignToAssets: (assetIds: string[], tagIds: string[]) =>
      ipcRenderer.invoke('tags:assign-to-assets', assetIds, tagIds),
    removeFromAssets: (assetIds: string[], tagIds: string[]) =>
      ipcRenderer.invoke('tags:remove-from-assets', assetIds, tagIds)
  },

  // File system
  fs: {
    selectDialog: (options?: {
      multi?: boolean
      filters?: Array<{ name: string; extensions: string[] }>
    }) => ipcRenderer.invoke('fs:select-dialog', options),
    selectFolderDialog: () => ipcRenderer.invoke('fs:select-folder-dialog'),
    openInExplorer: (filePath: string) => ipcRenderer.invoke('fs:open-in-explorer', filePath),
    pathToFileUrl: (filePath: string) =>
      ipcRenderer.invoke('fs:path-to-file-url', filePath) as Promise<string | null>,
    readFileBytes: (filePath: string) =>
      ipcRenderer.invoke('fs:read-file-bytes', filePath) as Promise<Uint8Array>,
    readTextFile: (filePath: string) =>
      ipcRenderer.invoke('fs:read-text-file', filePath) as Promise<string>,
    writeTextFile: (filePath: string, text: string, assetId?: string) =>
      ipcRenderer.invoke('fs:write-text-file', filePath, text, assetId) as Promise<{ bytes: number }>,
    /** Required in sandboxed renderer when File.path is unavailable (drag/drop, file input). */
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
    pathKind: (filePath: string) =>
      ipcRenderer.invoke('fs:path-kind', filePath) as Promise<'file' | 'directory' | 'missing'>,
    /** Show asset in system file manager (referenced = source path, local = library copy). */
    openAssetItemDirectory: (assetId: string) =>
      ipcRenderer.invoke('fs:open-asset-item-directory', assetId) as Promise<boolean>,
    copyFilesToClipboard: (assetIds: string[]) =>
      ipcRenderer.invoke('fs:copy-files-to-clipboard', assetIds) as Promise<boolean>,
    copyPathsToClipboard: (assetIds: string[]) =>
      ipcRenderer.invoke('fs:copy-paths-to-clipboard', assetIds) as Promise<number>
  },

  aiCanvas: {
    list: () => ipcRenderer.invoke('aiCanvas:list'),
    get: (id: string) => ipcRenderer.invoke('aiCanvas:get', id),
    create: (name: string) => ipcRenderer.invoke('aiCanvas:create', name),
    save: (doc: import('../shared/aiCanvasTypes').AiCanvasDocument) =>
      ipcRenderer.invoke('aiCanvas:save', doc),
    delete: (id: string) => ipcRenderer.invoke('aiCanvas:delete', id),
    importOutput: (payload: {
      pngBase64: string
      filename: string
      canvasId: string
      nodeId: string
      targetFolderId?: string
    }) =>
      ipcRenderer.invoke('aiCanvas:import-output', payload) as Promise<{ assetId: string } | null>
  },

  // Import progress events
  onImportProgress: (callback: (data: {
    current: number
    total: number
    filename: string
    status: 'processing' | 'done' | 'error'
  }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { current: number; total: number; filename: string; status: 'processing' | 'done' | 'error' }
    ) => callback(data)
    ipcRenderer.on('import:progress', handler)
    return () => ipcRenderer.removeListener('import:progress', handler)
  },

  onAssetsImported: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('assets:imported', handler)
    return () => ipcRenderer.removeListener('assets:imported', handler)
  },

  onDuplicateImportPrompt: (
    callback: (payload: import('../../shared/importTypes').DuplicateImportPromptPayload) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: import('../../shared/importTypes').DuplicateImportPromptPayload
    ) => callback(payload)
    ipcRenderer.on('import:duplicate-prompt', handler)
    return () => ipcRenderer.removeListener('import:duplicate-prompt', handler)
  },

  answerDuplicateImport: (
    requestId: string,
    answer: import('../../shared/importTypes').DuplicateImportAnswer
  ) => ipcRenderer.invoke('import:duplicate-answer', requestId, answer) as Promise<boolean>,

  onContentHashScanProgress: (
    callback: (data: import('../../shared/importTypes').ContentHashScanProgress) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: import('../../shared/importTypes').ContentHashScanProgress
    ) => callback(data)
    ipcRenderer.on('content-hash:scan-progress', handler)
    return () => ipcRenderer.removeListener('content-hash:scan-progress', handler)
  },

  onFontThumbRegenerateProgress: (
    callback: (data: { current: number; total: number; assetId: string; status: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { current: number; total: number; assetId: string; status: string }
    ) => callback(data)
    ipcRenderer.on('font-thumb:regenerate-progress', handler)
    return () => ipcRenderer.removeListener('font-thumb:regenerate-progress', handler)
  },

  onModelThumbRegenerateProgress: (
    callback: (data: { current: number; total: number; assetId: string; status: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { current: number; total: number; assetId: string; status: string }
    ) => callback(data)
    ipcRenderer.on('model-thumb:regenerate-progress', handler)
    return () => ipcRenderer.removeListener('model-thumb:regenerate-progress', handler)
  },

  onEmbeddedDccThumbRegenerateProgress: (
    callback: (data: { current: number; total: number; assetId: string; status: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { current: number; total: number; assetId: string; status: string }
    ) => callback(data)
    ipcRenderer.on('embedded-dcc-thumb:regenerate-progress', handler)
    return () => ipcRenderer.removeListener('embedded-dcc-thumb:regenerate-progress', handler)
  },

  onTextPreviewThumbRegenerateProgress: (
    callback: (data: { current: number; total: number; assetId: string; status: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { current: number; total: number; assetId: string; status: string }
    ) => callback(data)
    ipcRenderer.on('text-preview-thumb:regenerate-progress', handler)
    return () => ipcRenderer.removeListener('text-preview-thumb:regenerate-progress', handler)
  }
}

// Expose protected methods to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('assetVaultAPI', api)
  } catch (error) {
    console.error('Failed to expose API:', error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.assetVaultAPI = api
}

export type AssetVaultAPI = typeof api
