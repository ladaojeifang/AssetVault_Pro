import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { LibrarySettingsPanel } from './LibrarySettingsPanel'
import { FormatIconOverridesSection } from './FormatIconOverridesSection'
import {
  loadMasonryColumnWidth,
  saveMasonryColumnWidth,
  MASONRY_COLUMN_WIDTH_DEFAULT
} from '../../utils/masonryLayout'
import { useAppTheme } from '../../stores/ThemeContext'
import { useAppLocale } from '../../stores/LocaleContext'
import type { AppTheme } from '@/shared/appTheme'
import type { AppLocale } from '@/shared/appLocale'
import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences
} from '@/shared/appPreferences'
import type { WebApiPreferences } from '@/shared/webApiPreferences'
import { LOG_LEVELS, type LogLevel } from '@/shared/logLevel'
import { WebApiSettingsSection } from './WebApiSettingsSection'
import { formatAcceleratorForDisplay, listSettingsHotkeys } from '@/shared/hotkeyRegistry'

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
  onClose: () => void
}

function inferGridSizeFromColumnWidth(px: number): 'small' | 'medium' | 'large' {
  if (px <= 140) return 'small'
  if (px >= 260) return 'large'
  return 'medium'
}

const SettingsPage: React.FC<SettingsProps> = ({ onClose }) => {
  const { t } = useTranslation(['settings', 'common'])
  const [activeTab, setActiveTab] = useState('general')
  const [prefs, setPrefs] = useState<AppPreferences>({ ...DEFAULT_APP_PREFERENCES })
  const [gridSize, setGridSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void window.assetVaultAPI.settings.getAppPreferences().then((p) => {
      setPrefs(p)
    })
    setGridSize(inferGridSizeFromColumnWidth(loadMasonryColumnWidth()))
  }, [])

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
    { id: 'general', label: t('settings:tabs.general'), icon: '⚙️' },
    { id: 'library', label: t('settings:tabs.library'), icon: '📁' },
    { id: 'appearance', label: t('settings:tabs.appearance'), icon: '🎨' },
    { id: 'shortcuts', label: t('settings:tabs.shortcuts'), icon: '⌨️' },
    { id: 'advanced', label: t('settings:tabs.advanced'), icon: '🔧' }
  ]

  return (
    <div className="flex flex-col h-screen min-h-0 bg-av-bg-primary text-av-text-primary">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar tabs */}
        <div className="w-48 shrink-0 border-r border-av-border p-3 space-y-0.5 overflow-y-auto">
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
        <div className="flex-1 min-w-0 p-6 overflow-y-auto">
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
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-av-border shrink-0">
        <button onClick={onClose} className="btn-secondary">
          {t('common:cancel')}
        </button>
        <button
          disabled={saving}
          onClick={() => {
            void handleSave().then(() => onClose())
          }}
          className="btn-primary"
        >
          {saving ? t('common:saving') : t('common:saveChanges')}
        </button>
      </div>
    </div>
  )
}

function GeneralSettings({
  prefs,
  onUpdate
}: {
  prefs: AppPreferences
  onUpdate: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void
}) {
  const { t } = useTranslation('settings')
  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-4">{t('general.title')}</h3>

      <SettingField
        label={t('general.defaultImportPath')}
        description={t('general.defaultImportPathDesc')}
      >
        <input
          type="text"
          value={prefs.defaultImportPath}
          onChange={(e) => onUpdate('defaultImportPath', e.target.value)}
          placeholder={t('general.defaultImportPathPlaceholder')}
          className="input-base"
        />
      </SettingField>

      <SettingField
        label={t('general.autoWatch')}
        description={t('general.autoWatchDesc')}
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.autoWatchFolders}
            onChange={(e) => onUpdate('autoWatchFolders', e.target.checked)}
            className="w-4 h-4 rounded bg-av-bg-elevated border-av-border"
          />
          <span className="text-sm text-av-text-secondary">{t('general.enableFileWatching')}</span>
        </label>
      </SettingField>

      <SettingField
        label={t('general.thumbnailQuality')}
        description={t('general.thumbnailQualityDesc', { value: prefs.thumbnailQuality })}
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
        label={t('general.thumbnailSize')}
        description={t('general.thumbnailSizeDesc', { value: prefs.thumbnailMaxEdge })}
      >
        <select
          value={prefs.thumbnailMaxEdge}
          onChange={(e) => onUpdate('thumbnailMaxEdge', Number(e.target.value))}
          className="input-base w-auto"
        >
          <option value={128}>{t('general.thumbSize128')}</option>
          <option value={256}>{t('general.thumbSize256')}</option>
          <option value={384}>{t('general.thumbSize384')}</option>
          <option value={512}>{t('general.thumbSize512')}</option>
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
  const { t } = useTranslation('settings')
  const { theme, setTheme } = useAppTheme()
  const { locale, setLocale } = useAppLocale()

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-4">{t('appearance.title')}</h3>

      <SettingField label={t('appearance.language')} description={t('appearance.languageDesc')}>
        <select
          value={locale}
          onChange={(e) => {
            void setLocale(e.target.value as AppLocale)
          }}
          className="input-base w-auto min-w-[200px]"
        >
          <option value="zh-CN">{t('appearance.languageZh')}</option>
          <option value="en-US">{t('appearance.languageEn')}</option>
        </select>
      </SettingField>

      <SettingField label={t('appearance.theme')} description={t('appearance.themeDesc')}>
        <select
          value={theme}
          onChange={(e) => {
            const next = e.target.value as AppTheme
            void setTheme(next)
          }}
          className="input-base w-auto min-w-[200px]"
        >
          <option value="dark">{t('appearance.themeDark')}</option>
          <option value="light">{t('appearance.themeLight')}</option>
        </select>
      </SettingField>

      <SettingField
        label={t('appearance.masonry')}
        description={t('appearance.masonryDesc', { width: loadMasonryColumnWidth() })}
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
              {size === 'small'
                ? t('appearance.gridSmall')
                : size === 'medium'
                  ? t('appearance.gridMedium')
                  : t('appearance.gridLarge')}
            </button>
          ))}
        </div>
      </SettingField>
    </div>
  )
}

function ShortcutSettings() {
  const { t } = useTranslation('settings')
  const hotkeys = listSettingsHotkeys()
  const [editingId, setEditingId] = useState<string | null>(null)

  function captureHotkey(id: string) {
    setEditingId(id)
    // Custom rebinding not implemented yet
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-4">{t('shortcuts.title')}</h3>

      <p className="text-sm text-av-text-muted">{t('shortcuts.intro')}</p>

      <div className="space-y-1">
        {hotkeys.map((hk) => (
          <div
            key={hk.id}
            className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
              editingId === hk.id ? 'ring-1 ring-av-accent-blue bg-av-accent-blue/5' : 'hover:bg-av-bg-hover'
            }`}
          >
            <div>
              <p className="text-sm font-medium">{t(`shortcuts.items.${hk.i18nKey}`)}</p>
            </div>
            <button
              type="button"
              onClick={() => captureHotkey(hk.id)}
              className="px-3 py-1.5 rounded bg-av-bg-elevated border border-av-border text-xs font-mono text-av-text-primary hover:border-av-accent-blue transition-colors min-w-[100px] text-center"
            >
              {formatAcceleratorForDisplay(hk.accelerator)}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function LibraryStorageStatsCard(): React.ReactElement {
  const { t } = useTranslation('settings')
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
        <h4 className="text-sm font-semibold text-av-text-primary">{t('librarySelfCheck.title')}</h4>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary text-xs px-2 py-1">
          {loading ? t('librarySelfCheck.refreshing') : t('librarySelfCheck.refresh')}
        </button>
      </div>
      <p className="text-xs text-av-text-muted leading-relaxed">
        {t('librarySelfCheck.intro', {
          sqlite: 'library.sqlite',
          assetsTable: 'assets',
          itemsDir: 'items/'
        })}
      </p>
      {err != null && <p className="text-xs text-av-status-error-muted-text">{err}</p>}
      {stats != null && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-av-bg-secondary/80 px-3 py-2 border border-av-border/60">
            <dt className="text-xs text-av-text-muted">{t('librarySelfCheck.assetRows')}</dt>
            <dd className="font-mono text-av-text-primary tabular-nums mt-0.5">{stats.assetRowCount}</dd>
          </div>
          <div className="rounded-md bg-av-bg-secondary/80 px-3 py-2 border border-av-border/60">
            <dt className="text-xs text-av-text-muted">{t('librarySelfCheck.itemDirs')}</dt>
            <dd className="font-mono text-av-text-primary tabular-nums mt-0.5">{stats.itemPackCount}</dd>
          </div>
        </dl>
      )}
      {stats != null && diff != null && diff !== 0 && (
        <p className="text-xs text-av-status-warning-muted-text">
          {diff > 0
            ? t('librarySelfCheck.extraDirs', { count: diff })
            : t('librarySelfCheck.missingDirs', { count: -diff })}
        </p>
      )}
      {stats != null && diff === 0 && stats.assetRowCount > 0 && (
        <p className="text-xs text-av-status-success-muted-text">{t('librarySelfCheck.countsMatch')}</p>
      )}
      {stats != null && stats.assetRowCount === 0 && stats.itemPackCount === 0 && (
        <p className="text-xs text-av-text-muted">{t('librarySelfCheck.emptyLibrary')}</p>
      )}
      {stats != null && (
        <p className="text-[11px] text-av-text-muted font-mono break-all">
          {t('librarySelfCheck.itemsPath', { path: stats.itemsDir })}
        </p>
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
  const { t } = useTranslation('settings')
  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-4">{t('advanced.title')}</h3>

      <WebApiSettingsSection prefs={prefs} onUpdateWebApi={onUpdateWebApi} />

      <LibraryStorageStatsCard />

      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-sm text-yellow-400/80">⚠️ {t('advanced.warning')}</p>
      </div>

      <SettingField
        label={t('advanced.logLevel')}
        description={t('advanced.logLevelDesc')}
      >
        <select
          value={prefs.logLevel}
          onChange={(e) => onUpdate('logLevel', e.target.value as LogLevel)}
          className="input-base w-auto min-w-[240px]"
        >
          {LOG_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl === 'error'
                ? t('advanced.logLevelError')
                : lvl === 'warn'
                  ? t('advanced.logLevelWarn')
                  : lvl === 'info'
                    ? t('advanced.logLevelInfo')
                    : t('advanced.logLevelDebug')}
            </option>
          ))}
        </select>
      </SettingField>

      <SettingField
        label={t('advanced.searchDebounce')}
        description={t('advanced.searchDebounceDesc', { value: prefs.searchDebounceMs })}
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
        label={t('advanced.maxCache')}
        description={t('advanced.maxCacheDesc', { value: prefs.maxCacheSizeMB })}
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
