import React, { useState, useEffect, useCallback } from 'react'
import { Modal } from '@arco-design/web-react'
import { LibrarySettingsPanel } from './LibrarySettingsPanel'
import { FormatIconOverridesSection } from './FormatIconOverridesSection'
import {
  loadMasonryColumnWidth,
  saveMasonryColumnWidth,
  MASONRY_COLUMN_WIDTH_DEFAULT
} from '../../utils/masonryLayout'
import { useAppTheme } from '../../stores/ThemeContext'
import type { AppTheme } from '@/shared/appTheme'
import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences
} from '@/shared/appPreferences'
import type { WebApiPreferences } from '@/shared/webApiPreferences'
import { WebApiSettingsSection } from './WebApiSettingsSection'

const GRID_SIZE_COLUMN_WIDTH: Record<string, number> = {
  small: 120,
  medium: MASONRY_COLUMN_WIDTH_DEFAULT,
  large: 280
}

/**
 * Settings / Preferences Page
 * Storage paths, hotkey customization, appearance preferences
 */
interface SettingsProps {
  visible: boolean
  onClose: () => void
}

function inferGridSizeFromColumnWidth(px: number): 'small' | 'medium' | 'large' {
  if (px <= 140) return 'small'
  if (px >= 260) return 'large'
  return 'medium'
}

const SettingsPage: React.FC<SettingsProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState('general')
  const [prefs, setPrefs] = useState<AppPreferences>({ ...DEFAULT_APP_PREFERENCES })
  const [gridSize, setGridSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible) return
    void window.assetVaultAPI.settings.getAppPreferences().then((p) => {
      setPrefs(p)
    })
    setGridSize(inferGridSizeFromColumnWidth(loadMasonryColumnWidth()))
  }, [visible])

  const updatePref = useCallback(<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateWebApi = useCallback((webApi: WebApiPreferences) => {
    setPrefs((prev) => ({ ...prev, webApi }))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await window.assetVaultAPI.settings.setAppPreferences(prefs)
      saveMasonryColumnWidth(GRID_SIZE_COLUMN_WIDTH[gridSize] ?? MASONRY_COLUMN_WIDTH_DEFAULT)
    } catch (e) {
      console.error('[Settings] save failed:', e)
    } finally {
      setSaving(false)
    }
  }, [prefs, gridSize])

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'library', label: 'Library', icon: '📁' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' },
    { id: 'advanced', label: 'Advanced', icon: '🔧' }
  ]

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <span className="text-lg">Settings</span>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      footer={null}
      unmountOnExit
      style={{ width: 720, maxWidth: '90vw' }}
      className="settings-modal"
    >
      <div className="flex p-0" style={{ minHeight: 500 }}>
        {/* Sidebar tabs */}
        <div className="w-48 border-r border-av-border p-3 space-y-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-av-accent-blue/15 text-av-text-primary'
                  : 'text-av-text-secondary hover:bg-av-bg-hover'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'general' && <GeneralSettings prefs={prefs} onUpdate={updatePref} />}
          {activeTab === 'library' && <LibrarySettingsPanel />}
          {activeTab === 'appearance' && (
            <AppearanceSettings
              gridSize={gridSize}
              onGridSizeChange={(size) => {
                setGridSize(size)
                saveMasonryColumnWidth(GRID_SIZE_COLUMN_WIDTH[size] ?? MASONRY_COLUMN_WIDTH_DEFAULT)
              }}
            />
          )}
          {activeTab === 'shortcuts' && <ShortcutSettings />}
          {activeTab === 'advanced' && (
            <AdvancedSettings prefs={prefs} onUpdate={updatePref} onUpdateWebApi={updateWebApi} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-av-border">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          disabled={saving}
          onClick={() => {
            void handleSave().then(() => onClose())
          }}
          className="btn-primary"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  )
}

function GeneralSettings({
  prefs,
  onUpdate
}: {
  prefs: AppPreferences
  onUpdate: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-4">General Settings</h3>

      <SettingField
        label="Default Import Path"
        description="Default location when importing files"
      >
        <input
          type="text"
          value={prefs.defaultImportPath}
          onChange={(e) => onUpdate('defaultImportPath', e.target.value)}
          placeholder="Leave empty for system default"
          className="input-base"
        />
      </SettingField>

      <SettingField
        label="Auto-watch Folders"
        description="Automatically detect new files in imported folders"
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.autoWatchFolders}
            onChange={(e) => onUpdate('autoWatchFolders', e.target.checked)}
            className="w-4 h-4 rounded bg-av-bg-elevated border-av-border"
          />
          <span className="text-sm text-av-text-secondary">Enable file watching</span>
        </label>
      </SettingField>

      <SettingField
        label="Thumbnail Quality"
        description={`JPEG/WebP quality (1-100). Current: ${prefs.thumbnailQuality}%`}
      >
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={prefs.thumbnailQuality}
          onChange={(e) => onUpdate('thumbnailQuality', Number(e.target.value))}
          className="w-full h-1.5 bg-av-bg-elevated rounded-lg appearance-none cursor-pointer accent-av-accent-blue"
        />
      </SettingField>

      <SettingField
        label="Thumbnail Size"
        description={`Max dimension in pixels. Applies to newly generated thumbnails. Current: ${prefs.thumbnailMaxEdge}px`}
      >
        <select
          value={prefs.thumbnailMaxEdge}
          onChange={(e) => onUpdate('thumbnailMaxEdge', Number(e.target.value))}
          className="input-base w-auto"
        >
          <option value={128}>128px (Small)</option>
          <option value={256}>256px (Medium)</option>
          <option value={384}>384px (Large)</option>
          <option value={512}>512px (HD)</option>
        </select>
      </SettingField>

      <FormatIconOverridesSection />
    </div>
  )
}

function AppearanceSettings({
  gridSize,
  onGridSizeChange
}: {
  gridSize: 'small' | 'medium' | 'large'
  onGridSizeChange: (size: 'small' | 'medium' | 'large') => void
}) {
  const { theme, setTheme } = useAppTheme()

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-4">外观</h3>

      <SettingField label="软件主题" description="切换界面配色（立即生效并自动保存）">
        <select
          value={theme}
          onChange={(e) => {
            const next = e.target.value as AppTheme
            void setTheme(next)
          }}
          className="input-base w-auto min-w-[200px]"
        >
          <option value="dark">深色（默认）</option>
          <option value="light">浅色</option>
        </select>
      </SettingField>

      <SettingField
        label="瀑布流缩略图"
        description={`Ctrl/⌘+滚轮可微调。当前列宽约 ${loadMasonryColumnWidth()}px（列数随窗口宽度变化）`}
      >
        <div className="flex gap-2">
          {(['small', 'medium', 'large'] as const).map((size) => (
            <button
              key={size}
              onClick={() => onGridSizeChange(size)}
              className={`px-3 py-1.5 rounded-md text-xs capitalize transition-colors ${
                gridSize === size
                  ? 'bg-av-accent-blue text-white'
                  : 'bg-av-bg-elevated text-av-text-secondary hover:text-av-text-primary'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </SettingField>
    </div>
  )
}

function ShortcutSettings() {
  const [hotkeys, setHotkeys] = useState([
    { id: 'search', accelerator: 'Ctrl+K', description: 'Focus search bar' },
    { id: 'import-files', accelerator: 'Ctrl+I', description: 'Import files' },
    { id: 'import-folder', accelerator: 'Ctrl+Shift+O', description: 'Import folder' },
    { id: 'toggle-sidebar', accelerator: 'Ctrl+B', description: 'Toggle sidebar' },
    { id: 'toggle-detail', accelerator: 'Ctrl+D', description: 'Toggle detail panel' },
    { id: 'library-switcher', accelerator: 'Ctrl+L', description: 'Open library switcher (sidebar)' },
    { id: 'delete', accelerator: 'Delete', description: 'Delete selected' },
    { id: 'refresh', accelerator: 'F5', description: 'Refresh view' }
  ])
  const [editingId, setEditingId] = useState<string | null>(null)

  function captureHotkey(id: string) {
    setEditingId(id)
    // In a real implementation, this would listen for keyboard events
    // and capture the next key combination pressed
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-4">Keyboard Shortcuts</h3>

      <p className="text-sm text-av-text-muted">
        Click on a shortcut to customize. Press the new key combination to assign.
      </p>

      <div className="space-y-1">
        {hotkeys.map((hk) => (
          <div
            key={hk.id}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
              editingId === hk.id ? 'ring-1 ring-av-accent-blue bg-av-accent-blue/5' : 'hover:bg-av-bg-hover'
            }`}
          >
            <div>
              <p className="text-sm font-medium">{hk.description}</p>
              <p className="text-xs text-av-text-muted mt-0.5">{hk.id}</p>
            </div>
            <button
              onClick={() => captureHotkey(hk.id)}
              className="px-3 py-1.5 rounded bg-av-bg-elevated border border-av-border text-xs font-mono text-av-text-primary hover:border-av-accent-blue transition-colors min-w-[100px] text-center"
            >
              {hk.accelerator}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function LibraryStorageStatsCard(): React.ReactElement {
  const [stats, setStats] = useState<{ assetRowCount: number; itemPackCount: number; itemsDir: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const s = await window.assetVaultAPI.library.getStorageStats()
      setStats(s)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const unsub = window.assetVaultAPI.library.onLibrarySwitched(() => void load())
    return unsub
  }, [load])

  const diff =
    stats != null ? stats.itemPackCount - stats.assetRowCount : null

  return (
    <div className="p-4 rounded-lg bg-av-bg-elevated border border-av-border space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-av-text-primary">资料库自检</h4>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary text-xs px-2 py-1">
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>
      <p className="text-xs text-av-text-muted leading-relaxed">
        主界面列表来自 <code className="text-[11px] px-1 rounded bg-av-bg-secondary">library.sqlite</code> 的{' '}
        <code className="text-[11px] px-1 rounded bg-av-bg-secondary">assets</code> 表；此处对比磁盘上{' '}
        <code className="text-[11px] px-1 rounded bg-av-bg-secondary">items/</code> 子目录数量。
      </p>
      {err != null && <p className="text-xs text-red-400">{err}</p>}
      {stats != null && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-av-bg-secondary/80 px-3 py-2 border border-av-border/60">
            <dt className="text-xs text-av-text-muted">assets 行数</dt>
            <dd className="font-mono text-av-text-primary tabular-nums mt-0.5">{stats.assetRowCount}</dd>
          </div>
          <div className="rounded-md bg-av-bg-secondary/80 px-3 py-2 border border-av-border/60">
            <dt className="text-xs text-av-text-muted">items 子目录数</dt>
            <dd className="font-mono text-av-text-primary tabular-nums mt-0.5">{stats.itemPackCount}</dd>
          </div>
        </dl>
      )}
      {stats != null && diff != null && diff !== 0 && (
        <p className="text-xs text-amber-400/90">
          {diff > 0
            ? `磁盘上多 ${diff} 个目录：多为历史残留（库内已无对应记录），界面不会显示这些文件夹。`
            : `数据库记录比 items 子目录多 ${-diff} 条：可能部分包目录缺失或已被手动删除。`}
        </p>
      )}
      {stats != null && diff === 0 && stats.assetRowCount > 0 && (
        <p className="text-xs text-emerald-400/80">数量一致；若主界面仍为空，请检查侧栏文件夹筛选与类型筛选。</p>
      )}
      {stats != null && stats.assetRowCount === 0 && stats.itemPackCount === 0 && (
        <p className="text-xs text-av-text-muted">当前库为空，请通过导入或拖拽添加资源。</p>
      )}
      {stats != null && (
        <p className="text-[11px] text-av-text-muted font-mono break-all">items: {stats.itemsDir}</p>
      )}
    </div>
  )
}

function AdvancedSettings({
  prefs,
  onUpdate,
  onUpdateWebApi
}: {
  prefs: AppPreferences
  onUpdate: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void
  onUpdateWebApi: (webApi: WebApiPreferences) => void
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-4">Advanced Settings</h3>

      <WebApiSettingsSection prefs={prefs} onUpdateWebApi={onUpdateWebApi} />

      <LibraryStorageStatsCard />

      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-sm text-yellow-400/80">
          ⚠️ These settings may affect performance or stability.
        </p>
      </div>

      <SettingField
        label="Search Debounce"
        description={`Delay before search executes (ms). Save to apply. Current: ${prefs.searchDebounceMs}ms`}
      >
        <input
          type="range"
          min={100}
          max={800}
          step={50}
          value={prefs.searchDebounceMs}
          onChange={(e) => onUpdate('searchDebounceMs', Number(e.target.value))}
          className="w-full h-1.5 bg-av-bg-elevated rounded-lg appearance-none cursor-pointer accent-av-accent-blue"
        />
      </SettingField>

      <SettingField
        label="Max Cache Size"
        description={`In-memory thumbnail LRU cap (applies on save). Current: ${prefs.maxCacheSizeMB}MB`}
      >
        <input
          type="number"
          min={256}
          max={10240}
          step={256}
          value={prefs.maxCacheSizeMB}
          onChange={(e) => onUpdate('maxCacheSizeMB', Number(e.target.value))}
          className="input-base w-32"
        />
      </SettingField>
    </div>
  )
}

// Reusable form field component
function SettingField({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-av-text-primary">{label}</label>
      {description && <p className="text-xs text-av-text-muted">{description}</p>}
      {children}
    </div>
  )
}

export default SettingsPage
