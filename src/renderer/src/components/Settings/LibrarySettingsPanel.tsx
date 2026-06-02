import React, { useState, useCallback, useEffect } from 'react'
import type {
  ImportLibraryProgress,
  ImportLibrarySuccess,
  LibraryMode,
  LibraryModeStats
} from '@/shared/libraryTypes'
import { ContentHashScanButton } from './ContentHashScanButton'
import { FontThumbRegenerateButton } from './FontThumbRegenerateButton'
import { ModelThumbRegenerateButton } from './ModelThumbRegenerateButton'
import { FontSettingsSection } from './FontSettingsSection'

const MODE_LABEL: Record<LibraryMode, string> = {
  archive: '完整库',
  catalog: '索引库'
}

export function LibrarySettingsPanel(): React.ReactElement {
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
      const phaseLabel: Record<ImportLibraryProgress['phase'], string> = {
        validate: '校验',
        tags: '标签',
        folders: '文件夹',
        assets: '资产',
        finalize: '收尾'
      }
      if (p.phase === 'assets' && p.total > 0) {
        setImportProgress(`${phaseLabel[p.phase]} ${p.current}/${p.total} · ${p.filename}`)
      } else {
        setImportProgress(phaseLabel[p.phase])
      }
    })
    return () => {
      unsubSwitch()
      unsubUpgrade()
      unsubImport()
    }
  }, [load])

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
    if (!confirm('将把索引库中所有可访问的引用资产复制/硬链接进资料库，并转为完整库。是否继续？')) return
    setBusy(true)
    setUpgradeProgress('准备中…')
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
      ? `将从索引库「${pick.path}」合并到当前索引库：未本地化条目以引用方式合并；A 已本地化条目会在 B 中新建或补全本地副本（同 hash 且 B 已本地化则不重复占盘）。是否继续？`
      : `将从完整库「${pick.path}」一次性导入标签、文件夹与资产（重复文件按内容指纹合并，并打上来源库标签）。是否继续？`
    if (!confirm(confirmMsg)) {
      return
    }
    setBusy(true)
    setImportProgress('准备中…')
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
      alert(`已检查 ${r.checked} 条引用，${r.missing} 条源文件缺失`)
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
    return <p className="text-sm text-av-text-muted">正在加载资料库信息…</p>
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold mb-2">资料库</h3>
      <p className="text-sm text-av-text-secondary leading-relaxed">
        <strong>完整库</strong>：导入时拷贝原文件到 <code className="text-xs bg-av-bg-elevated px-1 rounded">items/</code>，可整体迁移。
        <strong className="ml-1">索引库</strong>：仅元数据与缩略图，原文件保留在原路径；可稍后转为完整库。
      </p>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</div>
      )}

      {upgradeProgress && (
        <div className="text-sm text-av-accent-blue bg-av-bg-elevated border border-av-border rounded-lg px-3 py-2">
          正在转为完整库：{upgradeProgress}
        </div>
      )}

      {importProgress && (
        <div className="text-sm text-av-accent-blue bg-av-bg-elevated border border-av-border rounded-lg px-3 py-2">
          正在从其它资料库导入：{importProgress}
        </div>
      )}

      {importResult && (
        <div className="text-sm text-av-text-secondary bg-av-bg-elevated border border-av-border rounded-lg px-3 py-2 space-y-1">
          <div className="font-medium text-av-text-primary">导入完成：{importResult.sourceDisplayName}</div>
          <div>
            新增 {importResult.assetsAdded} · 重复跳过 {importResult.assetsSkippedDuplicate} · 失败{' '}
            {importResult.assetsFailed}
          </div>
          {importResult.importMode === 'catalog_to_catalog_same_machine' && (
            <div className="text-xs text-av-text-muted">
              本地新增 {importResult.assetsAddedLocal ?? 0} · 引用新增 {importResult.assetsAddedReferenced ?? 0} ·
              补本地化 {importResult.assetsLocalizedOnImport ?? 0} · 已本地化重复{' '}
              {importResult.assetsSkippedDuplicateLocal ?? 0}
            </div>
          )}
          <div>
            文件夹 +{importResult.foldersCreated} / 合并 {importResult.foldersMerged} · 标签 +{importResult.tagsCreated} /
            合并 {importResult.tagsMerged}
          </div>
          <div className="text-xs text-av-text-muted">来源库标签：{importResult.sourceLibraryTagName}</div>
          {importResult.errors.length > 0 && (
            <details className="text-xs text-amber-300/90">
              <summary>{importResult.errors.length} 条失败详情</summary>
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
            关闭
          </button>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium text-av-text-muted uppercase tracking-wide">当前</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded ${
              state.libraryMode === 'catalog'
                ? 'bg-amber-950/50 text-amber-300 border border-amber-800/50'
                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
            }`}
          >
            {MODE_LABEL[state.libraryMode]}
          </span>
          <span className="text-sm text-av-text-secondary">{state.libraryDisplayName}</span>
        </div>
        <code className="text-xs text-av-text-secondary break-all block bg-av-bg-elevated rounded px-2 py-2 border border-av-border">
          {state.activeLibraryRoot}
        </code>
        {stats && (
          <p className="text-[11px] text-av-text-muted">
            库内副本 {stats.localCount} · 仅引用 {stats.referencedCount}
            {stats.missingSourceCount > 0 ? ` · 源缺失 ${stats.missingSourceCount}` : ''}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={busy}
            onClick={() => openFolder(state.activeLibraryRoot)}
          >
            在资源管理器中打开
          </button>
          <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void handlePick()}>
            打开其他资料库…
          </button>
          {(state.libraryMode === 'archive' || state.libraryMode === 'catalog') && (
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={busy}
              onClick={() => void handleImportFromLibrary()}
            >
              从其它资料库导入…
            </button>
          )}
          {state.libraryMode === 'catalog' && (
            <>
              <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void handleUpgrade()}>
                转为完整库…
              </button>
              <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void handleVerifySources()}>
                检查引用路径
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-av-text-muted uppercase tracking-wide">新建资料库</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={busy}
            onClick={() => void handleCreate('archive')}
          >
            新建完整库…
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={busy}
            onClick={() => void handleCreate('catalog')}
          >
            新建索引库…
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-av-text-muted uppercase tracking-wide">内容指纹（SHA-256）</div>
        <p className="text-sm text-av-text-secondary leading-relaxed">
          导入时会按文件大小与 SHA-256 检测重复，并询问是否使用已有资产。对已入库但尚未计算指纹的文件，可手动增量扫描。
        </p>
        <ContentHashScanButton disabled={busy} />
        <FontSettingsSection />
        <FontThumbRegenerateButton disabled={busy} />
        <ModelThumbRegenerateButton disabled={busy} />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-av-text-muted uppercase tracking-wide">最近使用</div>
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
                      切换
                    </button>
                  )}
                  {isActive && <span className="text-xs text-av-accent-blue py-1 px-2">当前</span>}
                  <button
                    type="button"
                    className="btn-secondary text-xs py-1 px-2"
                    disabled={busy}
                    onClick={() => openFolder(p)}
                  >
                    打开文件夹
                  </button>
                  {!isActive && (
                    <button
                      type="button"
                      className="text-xs text-av-text-muted hover:text-red-400 py-1 px-2"
                      disabled={busy}
                      onClick={() => void handleRemoveRecent(p)}
                    >
                      从列表移除
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-[11px] text-av-text-muted">
        当前与最近列表保存在应用目录下的 active-library.json（与资料库文件夹分离）。
      </p>
    </div>
  )
}
