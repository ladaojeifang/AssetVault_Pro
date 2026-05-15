import React, { useState, useCallback, useRef } from 'react'
import { useApp } from '../../stores/AppContext'

const Toolbar: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    sortField,
    sortOrder,
    setSorting,
    startImport,
    stopImport,
    isImporting,
    refreshAssets
  } = useApp()

  const [searchFocused, setSearchFocused] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleImportFiles = useCallback(async () => {
    try {
      const paths = await window.assetVaultAPI.fs.selectDialog({
        multi: true
      })
      if (paths.length > 0) {
        startImport()
        await window.assetVaultAPI.assets.import(paths as string[])
        await refreshAssets()
      }
    } catch (error) {
      console.error('Import error:', error)
    } finally {
      stopImport()
    }
  }, [startImport, stopImport, refreshAssets])

  const handleImportFolder = useCallback(async () => {
    try {
      const path = await window.assetVaultAPI.fs.selectFolderDialog()
      if (path) {
        startImport()
        await window.assetVaultAPI.assets.importFolder(path as string)
        await refreshAssets()
      }
    } catch (error) {
      console.error('Folder import error:', error)
    } finally {
      stopImport()
    }
  }, [startImport, stopImport, refreshAssets])

  return (
    <div className="flex items-center gap-3 h-11 px-4 bg-av-bg-secondary border-b border-av-border shrink-0">
      {/* Import buttons */}
      <div className="flex items-center gap-1.5">
        <button onClick={handleImportFiles} className="btn-primary text-xs" disabled={isImporting}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          Import
        </button>

        <button
          type="button"
          onClick={() => void handleImportFolder()}
          className="btn-secondary text-xs"
          disabled={isImporting}
          title="导入整个文件夹（Ctrl+Shift+O）"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          Folder
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-av-border" />

      {/* Search bar */}
      <div
        className={`flex items-center flex-1 max-w-md px-3 py-1.5 rounded-lg transition-all duration-200 ${
          searchFocused ? 'bg-av-bg-tertiary ring-1 ring-av-accent-blue/50' : 'bg-av-bg-elevated hover:bg-av-bg-hover'
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 transition-colors ${searchFocused ? 'text-av-accent-blue' : 'text-av-text-muted'}`}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search assets... (Ctrl+K)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="flex-1 bg-transparent border-none outline-none ml-2 text-sm text-av-text-primary placeholder:text-av-text-muted"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-av-text-muted hover:text-av-text-primary transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View toggle */}
      <div className="flex items-center bg-av-bg-elevated rounded-lg p-0.5">
        <button
          onClick={() => setViewMode('grid')}
          className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-av-bg-active text-av-accent-blue' : 'text-av-text-muted hover:text-av-text-primary'}`}
          title="Grid View"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-av-bg-active text-av-accent-blue' : 'text-av-text-muted hover:text-av-text-primary'}`}
          title="List View"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="5" width="18" height="3" rx="1" />
            <rect x="3" y="11" width="18" height="3" rx="1" />
            <rect x="3" y="17" width="18" height="3" rx="1" />
          </svg>
        </button>
      </div>

      {/* Sort options */}
      <select
        value={`${sortField}-${sortOrder}`}
        onChange={(e) => {
          const [field, order] = e.target.value.split('-')
          setSorting(field as any, order as any)
        }}
        className="bg-av-bg-elevated text-av-text-secondary border border-av-border rounded-lg px-2 py-1 text-xs outline-none cursor-pointer focus:border-av-accent-blue transition-colors"
      >
        <option value="importedAt-desc">Newest First</option>
        <option value="importedAt-asc">Oldest First</option>
        <option value="filename-asc">Name A-Z</option>
        <option value="filename-desc">Name Z-A</option>
        <option value="fileSize-desc">Largest</option>
        <option value="fileSize-asc">Smallest</option>
        <option value="viewCount-desc">Most Viewed</option>
        <option value="random-asc">Random</option>
      </select>
    </div>
  )
}

export default Toolbar
