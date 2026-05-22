import React, { useState, useCallback, useEffect } from 'react'
import { ContentHashScanButton } from './ContentHashScanButton'
import { FontThumbRegenerateButton } from './FontThumbRegenerateButton'
import { FontSettingsSection } from './FontSettingsSection'

export function LibrarySettingsPanel(): React.ReactElement {
  const [state, setState] = useState<{
    activeLibraryRoot: string
    recentLibraries: string[]
    libraryDisplayName: string
    manifestPath: string
    dbPath: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await window.assetVaultAPI.library.getState()
      setState(s)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const unsub = window.assetVaultAPI.library.onLibrarySwitched(() => void load())
    return unsub
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

  const handleCreate = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = (await window.assetVaultAPI.library.createAndSwitch()) as
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
      <h3 className="text-base font-semibold mb-2">资料库（可搬运）</h3>
      <p className="text-sm text-av-text-secondary leading-relaxed">
        每个资料库是一个文件夹，内含 <code className="text-xs bg-av-bg-elevated px-1 rounded">manifest.json</code>、
        <code className="text-xs bg-av-bg-elevated px-1 rounded">library.sqlite</code> 与{' '}
        <code className="text-xs bg-av-bg-elevated px-1 rounded">items/</code>。复制整个文件夹即可备份或迁移。
      </p>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium text-av-text-muted uppercase tracking-wide">当前</div>
        <code className="text-xs text-av-text-secondary break-all block bg-av-bg-elevated rounded px-2 py-2 border border-av-border">
          {state.activeLibraryRoot}
        </code>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => openFolder(state.activeLibraryRoot)}>
            在资源管理器中打开
          </button>
          <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void handlePick()}>
            打开其他资料库…
          </button>
          <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void handleCreate()}>
            新建空资料库…
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
                  {isActive && (
                    <span className="text-xs text-av-accent-blue py-1 px-2">当前</span>
                  )}
                  <button type="button" className="btn-secondary text-xs py-1 px-2" disabled={busy} onClick={() => openFolder(p)}>
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
