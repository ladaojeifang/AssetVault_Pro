import { useEffect } from 'react'
import { useApp } from '../stores/AppContext'
import { useAiCanvasNavOptional, type AppScreen } from '../stores/AiCanvasNavContext'

/**
 * Window-local shortcuts (only while AssetVault is focused).
 *
 * OS-wide `globalShortcut` is opt-in via ASSETVAULT_GLOBAL_HOTKEYS=1 in main — see main/index.ts.
 */

const HOTKEY_MAP: Record<string, (ctx: ReturnType<typeof useApp>) => void> = {
  search: (ctx) => {
    const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement | null
    input?.focus()
    input?.select()
  },

  'import-files': async (ctx) => {
    try {
      const paths = await window.assetVaultAPI.fs.selectDialog({ multi: true })
      if ((paths as string[]).length > 0) {
        ctx.startImport()
        await window.assetVaultAPI.assets.import(paths as string[])
        await ctx.refreshAssets()
        ctx.stopImport()
      }
    } catch (error) {
      console.error('Import error:', error)
      ctx.stopImport()
    }
  },

  'import-folder': async (ctx) => {
    try {
      const path = await window.assetVaultAPI.fs.selectFolderDialog()
      if (path) {
        ctx.startImport()
        await window.assetVaultAPI.assets.importFolder(path as string)
        await ctx.refreshAssets()
        ctx.stopImport()
      }
    } catch (error) {
      console.error('Folder import error:', error)
      ctx.stopImport()
    }
  },

  'toggle-sidebar': (ctx) => ctx.toggleSidebar(),

  'toggle-detail': (ctx) => ctx.toggleDetailPanel(),

  'view-grid': (ctx) => ctx.setViewMode('grid'),

  'view-list': (ctx) => ctx.setViewMode('list'),

  'select-all': (ctx) => {
    if (document.activeElement?.tagName === 'INPUT') return
    ctx.selectMultiple(ctx.assets.map((a) => a.id))
  },

  'delete-selected': async (ctx) => {
    if (ctx.selectedAssetIds.size === 0) return

    const count = ctx.selectedAssetIds.size
    if (!confirm(`Delete ${count} item${count > 1 ? 's' : ''}?`)) return

    try {
      await window.assetVaultAPI.assets.delete(Array.from(ctx.selectedAssetIds))
      ctx.clearSelection()
      await ctx.refreshAssets()
    } catch (error) {
      console.error('Delete error:', error)
    }
  },

  refresh: (ctx) => ctx.refreshAssets(),

  preview: (ctx) => {
    if (ctx.selectedAssetIds.size === 1) {
      ctx.setDetailPanelOpen(true)
    }
  },

  'open-settings': () => {
    window.dispatchEvent(new CustomEvent('assetvault:open-settings'))
  },

  'focus-library-switcher': () => {
    window.dispatchEvent(new CustomEvent('assetvault:focus-library-switcher'))
  }
}

/** Main process sends `webContents.send('hotkey:…')` — map channel → HOTKEY_MAP key */
const IPC_CHANNEL_TO_ACTION: Record<string, keyof typeof HOTKEY_MAP> = {
  'hotkey:focus-search': 'search',
  'hotkey:import-files': 'import-files',
  'hotkey:import-folder': 'import-folder',
  'hotkey:toggle-sidebar': 'toggle-sidebar',
  'hotkey:toggle-detail': 'toggle-detail',
  'hotkey:view-grid': 'view-grid',
  'hotkey:view-list': 'view-list',
  'hotkey:select-all': 'select-all',
  'hotkey:delete-selected': 'delete-selected',
  'hotkey:open-settings': 'open-settings',
  'hotkey:refresh': 'refresh',
  'hotkey:preview': 'preview'
}

export function useGlobalHotkeys() {
  const appCtx = useApp()
  const nav = useAiCanvasNavOptional()
  const screen: AppScreen = nav?.screen ?? 'library'

  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!el || !(el instanceof HTMLElement)) return false
      if (el.isContentEditable) return true
      const tag = el.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return true
      if (el.closest('[contenteditable="true"]')) return true
      return false
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return

      const hotkeyId = resolveHotkeyId(e, screen)
      if (hotkeyId && HOTKEY_MAP[hotkeyId]) {
        e.preventDefault()
        HOTKEY_MAP[hotkeyId](appCtx)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    const cleanupIpc = setupIpcHotkeyListener(appCtx)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      cleanupIpc()
    }
  }, [appCtx, screen])
}

function resolveHotkeyId(e: KeyboardEvent, screen: AppScreen): string | null {
  const ctrl = e.ctrlKey || e.metaKey
  const shift = e.shiftKey
  const key = e.key.toLowerCase()

  if (ctrl && !shift && key === 'k') return 'search'
  if (ctrl && !shift && key === 'i') return 'import-files'
  // Shift+O: avoids Chromium/Electron DevTools (Ctrl+Shift+I) conflict in dev
  if (ctrl && shift && key === 'o') return 'import-folder'
  if (ctrl && !shift && key === 'b') return 'toggle-sidebar'
  if (ctrl && !shift && key === 'd') return 'toggle-detail'
  if (ctrl && !shift && key === 'g') return 'view-grid'
  if (ctrl && shift && key === 'g') return 'view-list'
  if (ctrl && !shift && key === 'a') return 'select-all'
  if (key === 'delete' || (key === 'backspace' && !(e.target as HTMLElement).isContentEditable)) {
    // AI 画布内 Delete/Backspace 用于删除节点，勿触发资源库删除
    if (screen === 'ai-canvas-editor') return null
    return 'delete-selected'
  }
  if (key === 'f5' || (key === 'r' && ctrl)) return 'refresh'
  if (key === ' ') return 'preview'
  if (ctrl && !shift && key === ',') return 'open-settings'
  if (ctrl && !shift && key === 'l') return 'focus-library-switcher'

  return null
}

function setupIpcHotkeyListener(appCtx: ReturnType<typeof useApp>): () => void {
  const ipc = window.electron?.ipcRenderer
  if (!ipc?.on || !ipc.removeAllListeners) return () => {}

  const channels = Object.keys(IPC_CHANNEL_TO_ACTION)

  for (const channel of channels) {
    const action = IPC_CHANNEL_TO_ACTION[channel]
    const listener = () => {
      const fn = HOTKEY_MAP[action]
      if (fn) fn(appCtx)
    }
    ipc.on(channel, listener)
  }

  return () => {
    for (const channel of channels) {
      ipc.removeAllListeners(channel)
    }
  }
}

export function getDisplayString(accelerator: string): string {
  return accelerator
    .replace(/CommandOrCtrl/g, 'Ctrl')
    .replace(/\+/g, ' + ')
    .replace(/([A-Z])/g, '$1')
}
