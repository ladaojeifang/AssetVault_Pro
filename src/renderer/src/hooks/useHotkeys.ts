import { useEffect } from 'react'
import { useApp } from '../stores/AppContext'
import { useAiCanvasNavOptional, type AppScreen } from '../stores/AiCanvasNavContext'
import { notify } from '../components/Common/notify'
import { i18n } from '../i18n'
import { extensionsForDialog } from '@/shared/assetFormatRegistry'
import {
  IPC_CHANNEL_TO_HOTKEY,
  resolveHotkeyId,
  type HotkeyId
} from '@/shared/hotkeyRegistry'

const ta = () => i18n.getFixedT(i18n.language, 'assets')

/**
 * Window-local shortcuts (only while AssetVault is focused).
 *
 * OS-wide `globalShortcut` is opt-in via ASSETVAULT_GLOBAL_HOTKEYS=1 in main — see main/index.ts.
 */

const HOTKEY_MAP: Record<HotkeyId, (ctx: ReturnType<typeof useApp>) => void> = {
  search: () => {
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
    if (!confirm(ta()('notify.confirmDelete', { count }))) return

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
    void window.assetVaultAPI.window.openSettings()
  },

  'focus-library-switcher': () => {
    window.dispatchEvent(new CustomEvent('assetvault:focus-library-switcher'))
  },

  'custom-thumb-file': async (ctx) => {
    if (ctx.selectedAssetIds.size !== 1) return
    const id = Array.from(ctx.selectedAssetIds)[0]!
    try {
      const paths = await window.assetVaultAPI.fs.selectDialog({
        multi: false,
        filters: [
          {
            name: 'Images',
            extensions: extensionsForDialog('customThumb')
          }
        ]
      })
      const source = paths[0]
      if (!source) return
      await window.assetVaultAPI.assets.setCustomThumbnailFile(id, source)
      notify.success(ta()('notify.customThumbSet'))
      await ctx.refreshAssets()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : ta()('notify.thumbSetFailed'))
    }
  },

  'custom-thumb-clipboard': async (ctx) => {
    if (ctx.selectedAssetIds.size !== 1) return
    const id = Array.from(ctx.selectedAssetIds)[0]!
    try {
      await window.assetVaultAPI.assets.setCustomThumbnailFromClipboard(id)
      notify.success(ta()('notify.customThumbFromClipboard'))
      await ctx.refreshAssets()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : ta()('notify.thumbSetFailed'))
    }
  },

  'refresh-thumbnail': async (ctx) => {
    const ids = Array.from(ctx.selectedAssetIds)
    if (ids.length === 0) return
    try {
      const { updated } = await window.assetVaultAPI.assets.refreshThumbnail(ids)
      notify.success(ta()('notify.thumbsRefreshed', { updated, total: ids.length }))
      await ctx.refreshAssets()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : ta()('notify.refreshThumbFailed'))
    }
  }
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

function setupIpcHotkeyListener(appCtx: ReturnType<typeof useApp>): () => void {
  const ipc = window.electron?.ipcRenderer
  if (!ipc?.on || !ipc.removeAllListeners) return () => {}

  const channels = Object.keys(IPC_CHANNEL_TO_HOTKEY)

  for (const channel of channels) {
    const action = IPC_CHANNEL_TO_HOTKEY[channel]
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

export { formatAcceleratorForDisplay as getDisplayString } from '@/shared/hotkeyRegistry'
