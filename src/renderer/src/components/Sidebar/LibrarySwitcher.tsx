import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { LibraryMode } from '@/shared/libraryTypes'
import { useToast } from '../Common/Toast'
import { CreateLibraryModal } from './CreateLibraryModal'

type LibraryState = {
  activeLibraryRoot: string
  recentLibraries: string[]
  libraryDisplayName: string
  libraryMode: LibraryMode
  manifestPath: string
  dbPath: string
}

function folderBasename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1]! : p
}

/** Default manifest from `ensureManifest` — every new portable lib shares it, so the switcher must not use it as the primary label. */
function resolvePrimaryLibraryLabel(root: string, manifestDisplayName: string): string {
  const base = folderBasename(root)
  const dn = (manifestDisplayName || '').trim()
  if (!dn) return base
  if (dn.toLowerCase() === 'assetvault library') return base
  if (dn.toLowerCase() === base.toLowerCase()) return base
  return dn
}

export function LibrarySwitcherBar(): React.ReactElement {
  const { t } = useTranslation('library')
  const showToast = useToast()
  const [state, setState] = useState<LibraryState | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const s = (await window.assetVaultAPI.library.getState()) as LibraryState
      setState(s)
    } catch (e) {
      console.error('[LibrarySwitcher] load failed:', e)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const unsub = window.assetVaultAPI.library.onLibrarySwitched(() => void load())
    return unsub
  }, [load])

  useEffect(() => {
    const open = () => setMenuOpen(true)
    window.addEventListener('assetvault:focus-library-switcher', open)
    return () => window.removeEventListener('assetvault:focus-library-switcher', open)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const handleSwitch = async (path: string) => {
    if (!state) return
    if (path.toLowerCase() === state.activeLibraryRoot.toLowerCase()) {
      setMenuOpen(false)
      return
    }
    setBusy(true)
    try {
      const res = (await window.assetVaultAPI.library.switchRoot(path)) as
        | { ok: true }
        | { ok: false; error: string }
      if (!res.ok) {
        showToast({ type: 'error', title: t('switchFailed'), description: res.error })
        return
      }
      setMenuOpen(false)
    } catch (e) {
      showToast({
        type: 'error',
        title: t('switchFailed'),
        description: e instanceof Error ? e.message : String(e)
      })
    } finally {
      setBusy(false)
    }
  }

  const handlePick = async () => {
    setBusy(true)
    try {
      const res = (await window.assetVaultAPI.library.pickAndSwitch()) as
        | { ok: true }
        | { ok: false; error: string }
      if (!res.ok) {
        if (res.error !== 'cancelled') {
          showToast({ type: 'error', title: t('openFailed'), description: res.error })
        }
        return
      }
      setMenuOpen(false)
    } catch (e) {
      showToast({
        type: 'error',
        title: t('openFailed'),
        description: e instanceof Error ? e.message : String(e)
      })
    } finally {
      setBusy(false)
    }
  }

  const handleCreateWithMode = async (mode: LibraryMode) => {
    setBusy(true)
    try {
      const res = (await window.assetVaultAPI.library.createAndSwitch(mode)) as
        | { ok: true }
        | { ok: false; error: string }
      if (!res.ok) {
        if (res.error !== 'cancelled') {
          showToast({ type: 'error', title: t('createFailed'), description: res.error })
        }
        return
      }
      setMenuOpen(false)
      setCreateOpen(false)
      showToast({
        type: 'success',
        title: t('switchedNew'),
        description: mode === 'catalog' ? t('switchedCatalogDesc') : t('switchedArchiveDesc')
      })
    } catch (e) {
      showToast({
        type: 'error',
        title: t('createFailed'),
        description: e instanceof Error ? e.message : String(e)
      })
    } finally {
      setBusy(false)
    }
  }

  const openCreateModal = () => {
    setMenuOpen(false)
    setCreateOpen(true)
  }

  if (!state) {
    return (
      <div className="px-2 py-2 mb-1 rounded-md bg-av-bg-primary/40 border border-av-border/50 text-xs text-av-text-muted">
        {t('loading')}
      </div>
    )
  }

  const title = resolvePrimaryLibraryLabel(state.activeLibraryRoot, state.libraryDisplayName)

  return (
    <div ref={wrapRef} className="relative mb-2">
      <div className="flex gap-1 items-stretch">
        <button
          type="button"
          disabled={busy}
          onClick={() => setMenuOpen((o) => !o)}
          title={`${state.activeLibraryRoot}\n${t('switchTitle')}`}
          className={`flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm border transition-colors ${
            menuOpen
              ? 'bg-av-accent-blue/20 border-av-accent-blue/40 text-av-text-primary'
              : 'bg-av-bg-primary/50 border-av-border/60 text-av-text-secondary hover:text-av-text-primary hover:bg-av-bg-hover'
          } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <span className="shrink-0 w-6 h-6 rounded bg-av-accent-blue/25 flex items-center justify-center text-av-accent-blue">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              <path d="M8 7h8M8 11h5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="truncate flex-1 text-left font-medium text-av-text-primary min-w-0">{title}</span>
          <span
            className={`shrink-0 text-[9px] font-medium px-1 py-0.5 rounded border ${
              state.libraryMode === 'catalog'
                ? 'bg-amber-950/50 text-amber-300 border-amber-800/50'
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
            }`}
            title={state.libraryMode === 'catalog' ? t('catalogIndex') : t('archiveFull')}
          >
            {state.libraryMode === 'catalog' ? t('catalog') : t('archive')}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 text-av-text-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={openCreateModal}
          title={t('newLibrary')}
          className="shrink-0 w-9 rounded-md border border-av-border/60 bg-av-bg-primary/50 text-av-text-secondary hover:text-av-accent-blue hover:bg-av-bg-hover hover:border-av-accent-blue/40 transition-colors flex items-center justify-center text-lg leading-none font-light disabled:opacity-50"
        >
          +
        </button>
      </div>

      {menuOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-[500] rounded-lg border border-av-border bg-av-bg-elevated shadow-xl py-1 max-h-72 overflow-y-auto scrollbar-hide"
          role="menu"
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-av-text-muted">
            {t('recent')}
          </div>
          {state.recentLibraries.map((p) => {
            const active = p.toLowerCase() === state.activeLibraryRoot.toLowerCase()
            const label = folderBasename(p)
            return (
              <button
                key={p}
                type="button"
                role="menuitem"
                disabled={busy || active}
                title={p}
                onClick={() => void handleSwitch(p)}
                className={`w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 transition-colors ${
                  active
                    ? 'bg-av-accent-blue/15 text-av-text-primary cursor-default'
                    : 'text-av-text-secondary hover:bg-av-bg-hover hover:text-av-text-primary'
                }`}
              >
                <span className="font-medium truncate">{label}</span>
                {!active && <span className="text-[10px] text-av-text-muted font-mono truncate opacity-80">{p}</span>}
                {active && <span className="text-[10px] text-av-accent-blue">{t('current')}</span>}
              </button>
            )
          })}
          <div className="my-1 h-px bg-av-border/80" />
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => void handlePick()}
            className="w-full text-left px-3 py-2 text-xs text-av-text-secondary hover:bg-av-bg-hover hover:text-av-text-primary"
          >
            {t('openOther')}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={openCreateModal}
            className="w-full text-left px-3 py-2 text-xs text-av-text-secondary hover:bg-av-bg-hover hover:text-av-text-primary"
          >
            {t('newLibrary')}
          </button>
        </div>
      )}

      <CreateLibraryModal
        visible={createOpen}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onConfirm={(mode) => void handleCreateWithMode(mode)}
      />
    </div>
  )
}
