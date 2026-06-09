import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ImportLibraryProgress,
  ImportLibrarySuccess,
  LibraryMode,
  LibraryModeStats
} from '@/shared/libraryTypes'
import { ContentHashScanButton } from './ContentHashScanButton'
import { FontThumbRegenerateButton } from './FontThumbRegenerateButton'
import { ModelThumbRegenerateButton } from './ModelThumbRegenerateButton'
import { EmbeddedDccThumbRegenerateButton } from './EmbeddedDccThumbRegenerateButton'
import { TextPreviewThumbRegenerateButton } from './TextPreviewThumbRegenerateButton'
import { FontSettingsSection } from './FontSettingsSection'

export function LibrarySettingsPanel(): React.ReactElement {
  const { t } = useTranslation('library')
  const [state, setState] = useState<{
    activeLibraryRoot: string
    recentLibraries: string[]
    libraryDisplayName: string
    libraryMode: LibraryMode
    manifestPath: string
    dbPath: string
  } | null>(null)
  const [stats, setStats] = useState<LibraryModeStats | null>(null)
  const [busy, setBusy] = useState(false)
  const [upgradeProgress, setUpgradeProgress] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportLibrarySuccess | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await window.assetVaultAPI.library.getState()
      setState(s)
      const info = await window.assetVaultAPI.library.getInfo()
      setStats(info.stats)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const unsubSwitch = window.assetVaultAPI.library.onLibrarySwitched(() => void load())
    const unsubUpgrade = window.assetVaultAPI.library.onUpgradeProgress((p) => {
      setUpgradeProgress(`${p.current}/${p.total} · ${p.filename}`)
    })
    const unsubImport = window.assetVaultAPI.library.onImportProgress((p: ImportLibraryProgress) => {
      const phaseLabel = t(`importPhase.${p.phase}`)
      if (p.phase === 'assets' && p.total > 0) {
        setImportProgress(t('importPhaseProgress', { phase: phaseLabel, current: p.current, total: p.total, filename: p.filename }))
      } else {
        setImportProgress(phaseLabel)
      }
    })
    return () => {
      unsubSwitch()
      unsubUpgrade()
      unsubImport()
    }
  }, [load, t])

  const handleSwitch = async (path: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = (await window.assetVaultAPI.library.switchRoot(path)) as
        | { ok: true }
        | { ok: false; error: string }
      if (!res.ok) {
        setError(res.error)
        return
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handlePick = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = (await window.assetVaultAPI.library.pickAndSwitch()) as
        | { ok: true }
        | { ok: false; error: string }
      if (!res.ok) {
        if (res.error !== 'cancelled') setError(res.error)
        return
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async (mode: LibraryMode) => {
    setBusy(true)
    setError(null)
    try {
      const res = (await window.assetVaultAPI.library.createAndSwitch(mode)) as
        | { ok: true }
        | { ok: false; error: string }
      if (!res.ok) {
        if (res.error !== 'cancelled') setError(res.error)
        return
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleUpgrade = async () => {
    if (!confirm(t('upgradeConfirm'))) return
    setBusy(true)
    setUpgradeProgress(t('preparing'))
    setError(null)
    try {
      const res = (await window.assetVaultAPI.library.upgradeToArchive({ preferHardlink: true })) as
        | { ok: true }
        | { ok: false; error: string }
      if (!res.ok) setError(res.error)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setUpgradeProgress(null)
    }
  }

  const handleImportFromLibrary = async () => {
    const pick = await window.assetVaultAPI.library.pickSourceLibraryRoot()
    if (!pick.ok) {
      if (pick.error !== 'cancelled') setError(pick.error)
      return
    }
    const isCatalog = state?.libraryMode === 'catalog'
    const confirmMsg = isCatalog
      ? t('importConfirmCatalogMerge', { path: pick.path })
      : t('importConfirmArchiveImport', { path: pick.path })
    if (!confirm(confirmMsg)) {
      return
    }
    setBusy(true)
    setImportProgress(t('preparing'))
    setError(null)
    setImportResult(null)
    try {
      const res = await window.assetVaultAPI.library.importFromLibrary(pick.path)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setImportResult(res)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setImportProgress(null)
    }
  }

  const handleVerifySources = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await window.assetVaultAPI.library.verifySources()
      await load()
      alert(t('verifySourcesResult', { checked: r.checked, missing: r.missing }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveRecent = async (path: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = (await window.assetVaultAPI.library.removeFromRecent(path)) as
        | { ok: true }
        | { ok: false; error: string }
      if (!res.ok) {
        setError(res.error)
        return
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const openFolder = (p: string) => {
    void window.assetVaultAPI.fs.openInExplorer(p)
  }

  if (!state) {
    return <p className="text-sm text-av-text-muted">{t('loadingInfo')}</p>
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-2">{t('panelTitle')}</h3>
      <p className="text-sm text-av-text-secondary leading-relaxed">
        {t('panelArchiveDesc')} {t('panelCatalogDesc')}
      </p>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</div>
      )}

      {upgradeProgress && (
        <div className="text-sm text-av-accent-blue bg-av-bg-elevated border border-av-border rounded-lg px-3 py-2">
          {t('upgrading', { progress: upgradeProgress })}
        </div>
      )}

      {importProgress && (
        <div className="text-sm text-av-accent-blue bg-av-bg-elevated border border-av-border rounded-lg px-3 py-2">
          {t('importing', { progress: importProgress })}
        </div>
      )}

      {importResult && (
        <div className="text-sm text-av-text-secondary bg-av-bg-elevated border border-av-border rounded-lg px-3 py-2 space-y-1">
          <div className="font-medium text-av-text-primary">
            {t('importComplete', { name: importResult.sourceDisplayName })}
          </div>
          <div>
            {t('importSummary', {
              added: importResult.assetsAdded,
              skipped: importResult.assetsSkippedDuplicate,
              failed: importResult.assetsFailed
            })}
          </div>
          {importResult.importMode === 'catalog_to_catalog_same_machine' && (
            <div className="text-xs text-av-text-muted">
              {t('importCatalogStatsDetailed', {
                local: importResult.assetsAddedLocal ?? 0,
                ref: importResult.assetsAddedReferenced ?? 0,
                localized: importResult.assetsLocalizedOnImport ?? 0,
                skippedLocal: importResult.assetsSkippedDuplicateLocal ?? 0
              })}
            </div>
          )}
          <div>
            {t('importFolderTagStats', {
              created: importResult.foldersCreated,
              merged: importResult.foldersMerged,
              tagsCreated: importResult.tagsCreated,
              tagsMerged: importResult.tagsMerged
            })}
          </div>
          <div className="text-xs text-av-text-muted">
            {t('sourceLibraryTag', { name: importResult.sourceLibraryTagName })}
          </div>
          {importResult.errors.length > 0 && (
            <details className="text-xs text-amber-300/90">
              <summary>{t('failureDetails', { count: importResult.errors.length })}</summary>
              <ul className="mt-1 list-disc pl-4 max-h-32 overflow-y-auto">
                {importResult.errors.map((e: ImportLibrarySuccess['errors'][number]) => (
                  <li key={e.sourceAssetId}>
                    {e.filename}: {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button type="button" className="btn-secondary text-xs mt-2" onClick={() => setImportResult(null)}>
            {t('dismiss')}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium text-av-text-muted uppercase tracking-wide">{t('sectionCurrent')}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded ${
              state.libraryMode === 'catalog'
                ? 'bg-amber-950/50 text-amber-300 border border-amber-800/50'
                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
            }`}
          >
            {state.libraryMode === 'catalog' ? t('catalogIndex') : t('archiveFull')}
          </span>
          <span className="text-sm text-av-text-secondary">{state.libraryDisplayName}</span>
        </div>
        <code className="text-xs text-av-text-secondary break-all block bg-av-bg-elevated rounded px-2 py-2 border border-av-border">
          {state.activeLibraryRoot}
        </code>
        {stats && (
          <p className="text-[11px] text-av-text-muted">
            {t('localCopies', { local: stats.localCount, referenced: stats.referencedCount })}
            {stats.missingSourceCount > 0
              ? t('missingSources', { count: stats.missingSourceCount })
              : ''}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={busy}
            onClick={() => openFolder(state.activeLibraryRoot)}
          >
            {t('openInExplorer')}
          </button>
          <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void handlePick()}>
            {t('openOther')}
          </button>
          {(state.libraryMode === 'archive' || state.libraryMode === 'catalog') && (
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={busy}
              onClick={() => void handleImportFromLibrary()}
            >
              {t('importFromOther')}
            </button>
          )}
          {state.libraryMode === 'catalog' && (
            <>
              <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void handleUpgrade()}>
                {t('upgradeToArchive')}
              </button>
              <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void handleVerifySources()}>
                {t('checkReferences')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-av-text-muted uppercase tracking-wide">{t('sectionNew')}</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={busy}
            onClick={() => void handleCreate('archive')}
          >
            {t('newArchive')}
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={busy}
            onClick={() => void handleCreate('catalog')}
          >
            {t('newCatalog')}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-av-text-muted uppercase tracking-wide">{t('sectionFingerprint')}</div>
        <p className="text-sm text-av-text-secondary leading-relaxed">{t('fingerprintDesc')}</p>
        <ContentHashScanButton disabled={busy} />
        <FontSettingsSection />
        <FontThumbRegenerateButton disabled={busy} />
        <ModelThumbRegenerateButton disabled={busy} />
        <EmbeddedDccThumbRegenerateButton disabled={busy} />
        <TextPreviewThumbRegenerateButton disabled={busy} />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-av-text-muted uppercase tracking-wide">{t('sectionRecent')}</div>
        <ul className="space-y-2 max-h-56 overflow-y-auto">
          {state.recentLibraries.map((p) => {
            const isActive = p.toLowerCase() === state.activeLibraryRoot.toLowerCase()
            return (
              <li
                key={p}
                className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-av-border bg-av-bg-elevated/50 px-3 py-2"
              >
                <code className="text-xs text-av-text-secondary break-all flex-1">{p}</code>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {!isActive && (
                    <button
                      type="button"
                      className="btn-primary text-xs py-1 px-2"
                      disabled={busy}
                      onClick={() => void handleSwitch(p)}
                    >
                      {t('switch')}
                    </button>
                  )}
                  {isActive && <span className="text-xs text-av-accent-blue py-1 px-2">{t('current')}</span>}
                  <button
                    type="button"
                    className="btn-secondary text-xs py-1 px-2"
                    disabled={busy}
                    onClick={() => openFolder(p)}
                  >
                    {t('openFolder')}
                  </button>
                  {!isActive && (
                    <button
                      type="button"
                      className="text-xs text-av-text-muted hover:text-red-400 py-1 px-2"
                      disabled={busy}
                      onClick={() => void handleRemoveRecent(p)}
                    >
                      {t('removeFromList')}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-[11px] text-av-text-muted">{t('recentListHint')}</p>
    </div>
  )
}
