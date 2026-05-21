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
    isMaximized: () => ipcRenderer.invoke('window:is-maximized')
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
    import: (filePaths: string[], targetFolderId?: string) =>
      ipcRenderer.invoke('assets:import', filePaths, targetFolderId),
    importFolder: (folderPath: string) => ipcRenderer.invoke('assets:import-folder', folderPath),
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
    getThumbnail: (id: string) => ipcRenderer.invoke('assets:get-thumbnail', id),
    analyzeColors: (id: string) => ipcRenderer.invoke('assets:analyze-colors', id),
    rename: (id: string, newName: string) =>
      ipcRenderer.invoke('assets:rename', id, newName) as Promise<{ filename: string }>,
    analyzeColorsBatch: (ids: string[]) =>
      ipcRenderer.invoke('assets:analyze-colors-batch', ids) as Promise<{ updated: number }>,
    copyToLibrary: (assetIds: string[], targetLibraryRoot: string) =>
      ipcRenderer.invoke('assets:copy-to-library', assetIds, targetLibraryRoot) as Promise<{
        copied: number
        skipped: number
      }>
  },

  library: {
    getInfo: () =>
      ipcRenderer.invoke('library:get-info') as Promise<{
        libraryRoot: string
        manifestPath: string
        dbPath: string
      }>,
    getState: () =>
      ipcRenderer.invoke('library:get-state') as Promise<{
        activeLibraryRoot: string
        recentLibraries: string[]
        libraryDisplayName: string
        manifestPath: string
        dbPath: string
      }>,
    switchRoot: (targetRoot: string) => ipcRenderer.invoke('library:switch', targetRoot),
    pickAndSwitch: () => ipcRenderer.invoke('library:pick-and-switch'),
    createAndSwitch: () => ipcRenderer.invoke('library:create-and-switch'),
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
    }
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
    /** Required in sandboxed renderer when File.path is unavailable (drag/drop, file input). */
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
    pathKind: (filePath: string) =>
      ipcRenderer.invoke('fs:path-kind', filePath) as Promise<'file' | 'directory' | 'missing'>,
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
