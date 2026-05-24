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

const SettingsPage: React.FC<SettingsProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState({
    // General
    defaultImportPath: '',
    autoWatchFolders: true,
    thumbnailQuality: 80,
    thumbnailSize: 256,
    maxCacheSizeMB: 2048,

    // Appearance
    theme: 'dark',
    gridColumns: 8,
    gridSize: 'medium' as 'small' | 'medium' | 'large',

    // Shortcuts
    customHotkeys: {} as Record<string, string>,

    // Advanced
    enableFileWatcher: true,
    ftsMinLength: 2,
    debounceMs: 300
  })

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
          {activeTab === 'general' && <GeneralSettings settings={settings} onUpdate={(k, v) => updateSetting(k as any, v)} />}
          {activeTab === 'library' && <LibrarySettingsPanel />}
          {activeTab === 'appearance' && <AppearanceSettings settings={settings} onUpdate={(k, v) => updateSetting(k as any, v)} />}
          {activeTab === 'shortcuts' && <ShortcutSettings />}
          {activeTab === 'advanced' && <AdvancedSettings settings={settings} onUpdate={(k, v) => updateSetting(k as any, v)} />}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-av-border">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={() => {
            saveSettings()
            onClose()
          }}
          className="btn-primary"
        >
          Save Changes
        </button>
      </div>
    </Modal>
  )
}

function GeneralSettings({
  settings,
  onUpdate
}: {
  settings: Record<string, unknown>
  onUpdate: (key: string, value: unknown) => void
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
          value={(settings.defaultImportPath as string) || ''}
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
            checked={settings.autoWatchFolders as boolean}
            onChange={(e) => onUpdate('autoWatchFolders', e.target.checked)}
            className="w-4 h-4 rounded bg-av-bg-elevated border-av-border"
          />
          <span className="text-sm text-av-text-secondary">Enable file watching</span>
        </label>
      </SettingField>

      <SettingField
        label="Thumbnail Quality"
        description={`JPEG/WebP quality (1-100). Current: ${settings.thumbnailQuality}%`}
      >
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={settings.thumbnailQuality as number}
          onChange={(e) => onUpdate('thumbnailQuality', Number(e.target.value))}
          className="w-full h-1.5 bg-av-bg-elevated rounded-lg appearance-none cursor-pointer accent-av-accent-blue"
        />
      </SettingField>

      <SettingField
        label="Thumbnail Size"
        description={`Max dimension in pixels. Current: ${settings.thumbnailSize}px`}
      >
        <select
          value={settings.thumbnailSize as number}
          onChange={(e) => onUpdate('thumbnailSize', Number(e.target.value))}
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
  settings,
  onUpdate
}: {
  settings: Record<string, unknown>
  onUpdate: (key: string, value: unknown) => void
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
            onUpdate('theme', next)
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
              onClick={() => {
                onUpdate('gridSize', size)
                saveMasonryColumnWidth(GRID_SIZE_COLUMN_WIDTH[size] ?? MASONRY_COLUMN_WIDTH_DEFAULT)
              }}
              className={`px-3 py-1.5 rounded-md text-xs capitalize transition-colors ${
                settings.gridSize === size
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
  settings,
  onUpdate
}: {
  settings: Record<string, unknown>
  onUpdate: (key: string, value: unknown) => void
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-4">Advanced Settings</h3>

      <LibraryStorageStatsCard />

      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-sm text-yellow-400/80">
          ⚠️ These settings may affect performance or stability.
        </p>
      </div>

      <SettingField
        label="Enable File Watcher"
        description="Auto-sync file changes from watched folders"
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enableFileWatcher as boolean}
            onChange={(e) => onUpdate('enableFileWatcher', e.target.checked)}
            className="w-4 h-4 rounded bg-av-bg-elevated border-av-border"
          />
          <span className="text-sm text-av-text-secondary">Enable</span>
        </label>
      </SettingField>

      <SettingField
        label="Search Debounce"
        description={`Delay before search executes (ms). Current: ${settings.debounceMs}ms`}
      >
        <input
          type="range"
          min={100}
          max={800}
          step={50}
          value={settings.debounceMs as number}
          onChange={(e) => onUpdate('debounceMs', Number(e.target.value))}
          className="w-full h-1.5 bg-av-bg-elevated rounded-lg appearance-none cursor-pointer accent-av-accent-blue"
        />
      </SettingField>

      <SettingField
        label="Max Cache Size"
        description={`Maximum disk cache for thumbnails (MB). Current: ${settings.maxCacheSizeMB}MB`}
      >
        <input
          type="number"
          min={256}
          max={10240}
          step={256}
          value={settings.maxCacheSizeMB as number}
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

async function updateSetting(_key: string, _value: unknown): Promise<void> {
  // Settings would be persisted via IPC or local storage
}

function saveSettings(): void {
  // Persist all settings
  console.log('[Settings] Saving preferences...')
}

export default SettingsPage
