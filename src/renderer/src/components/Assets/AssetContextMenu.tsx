import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import type { AssetItem, FolderItem } from '@/shared/types'
import { flattenFolderTree } from '../../utils/flattenFolderTree'

export type AssetContextMenuState = {
  assetIds: string[]
  primaryAsset: AssetItem
  x: number
  y: number
} | null

type MenuItem = {
  key: string
  label: string
  disabled?: boolean
  danger?: boolean
  separator?: boolean
  shortcut?: string
  submenu?: 'folders' | 'libraries'
}

const MENU_MIN_WIDTH = 200
const MENU_ITEM_HEIGHT = 36
const MENU_PAD = 8
const SUBMENU_WIDTH = 220
const SUBMENU_MAX_HEIGHT = 280

function folderBasename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1]! : p
}

export function AssetContextMenu({
  state,
  folderTree,
  currentFolderId,
  recentLibraries,
  activeLibraryRoot,
  onClose,
  onAction
}: {
  state: AssetContextMenuState
  folderTree: FolderItem[]
  currentFolderId: string | null
  recentLibraries: string[]
  activeLibraryRoot: string
  onClose: () => void
  onAction: (key: string, assetIds: string[], extra?: string) => void
}) {
  const { t } = useTranslation('assets')
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [openSubmenu, setOpenSubmenu] = useState<'folders' | 'libraries' | null>(null)
  const [submenuPos, setSubmenuPos] = useState<{ left: number; top: number } | null>(null)

  const flatFolders = flattenFolderTree(folderTree)
  const otherLibraries = recentLibraries.filter(
    (p) => p.toLowerCase() !== activeLibraryRoot.toLowerCase()
  )

  const canSetCover =
    !!currentFolderId &&
    state != null &&
    (state.primaryAsset.fileType === 'image' || state.primaryAsset.hasThumbnail)

  const canAnalyzeColors =
    state != null &&
    (state.primaryAsset.fileType === 'image' || state.primaryAsset.fileType === 'video')

  useLayoutEffect(() => {
    if (!state) {
      setPos(null)
      return
    }
    const el = menuRef.current
    const w = el?.offsetWidth ?? MENU_MIN_WIDTH
    const h = el?.offsetHeight ?? MENU_ITEM_HEIGHT * 10 + MENU_PAD
    setPos({
      left: Math.max(8, Math.min(state.x, window.innerWidth - w - 8)),
      top: Math.max(8, Math.min(state.y, window.innerHeight - h - 8))
    })
  }, [state])

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current && !menuRef.current.contains(t)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer, true)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer, true)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [state, onClose])

  useEffect(() => {
    if (!openSubmenu || !menuRef.current) {
      setSubmenuPos(null)
      return
    }
    const rect = menuRef.current.getBoundingClientRect()
    let left = rect.right + 4
    if (left + SUBMENU_WIDTH > window.innerWidth - 8) {
      left = rect.left - SUBMENU_WIDTH - 4
    }
    setSubmenuPos({
      left: Math.max(8, left),
      top: Math.max(8, Math.min(rect.top, window.innerHeight - SUBMENU_MAX_HEIGHT - 8))
    })
  }, [openSubmenu, pos])

  if (!state) return null

  const { assetIds } = state
  const multi = assetIds.length > 1

  const items: MenuItem[] = [
    { key: 'explorer', label: t('contextMenu.openExplorer') },
    { key: 'add-folder', label: t('contextMenu.addToFolder'), submenu: 'folders' },
    {
      key: 'add-library',
      label: t('contextMenu.addToOtherLibrary'),
      submenu: 'libraries',
      disabled: otherLibraries.length === 0
    },
    { key: 'set-cover', label: t('contextMenu.setCover'), disabled: !canSetCover },
    { key: 'rename', label: t('contextMenu.rename'), disabled: multi },
    {
      key: 'copy-files',
      label: multi
        ? t('contextMenu.copyFilesMulti', { count: assetIds.length })
        : t('contextMenu.copyFiles')
    },
    {
      key: 'copy-paths',
      label: multi
        ? t('contextMenu.copyPathsMulti', { count: assetIds.length })
        : t('contextMenu.copyPaths')
    },
    {
      key: 'analyze-colors',
      label: multi
        ? t('contextMenu.reanalyzeColorMulti', { count: assetIds.length })
        : t('contextMenu.reanalyzeColor'),
      disabled: !canAnalyzeColors
    },
    { key: 'sep-thumb', label: '', separator: true },
    {
      key: 'custom-thumb-file',
      label: t('contextMenu.customThumbFile'),
      shortcut: 'Ctrl+Alt+T',
      disabled: multi
    },
    {
      key: 'custom-thumb-clipboard',
      label: t('contextMenu.customThumbClipboard'),
      shortcut: 'Ctrl+Shift+Alt+T',
      disabled: multi
    },
    {
      key: 'refresh-thumbnail',
      label: t('contextMenu.refreshThumb'),
      shortcut: 'Ctrl+Alt+R'
    },
    {
      key: 'delete',
      label: multi
        ? t('contextMenu.deleteMulti', { count: assetIds.length })
        : t('contextMenu.delete'),
      danger: true
    }
  ]

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="av-context-menu fixed z-[10000] min-w-[200px]"
      style={{ left: pos?.left ?? state.x, top: pos?.top ?? state.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) =>
        item.separator ? (
          <div key={item.key} className="h-px bg-av-border/80 my-1 mx-2" role="separator" />
        ) : (
        <div
          key={item.key}
          className="relative"
          onMouseEnter={() => {
            if (item.submenu) setOpenSubmenu(item.submenu)
            else setOpenSubmenu(null)
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 transition-colors ${
              item.disabled
                ? 'text-av-text-muted/50 cursor-not-allowed'
                : item.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-av-text-primary hover:bg-av-bg-hover'
            }`}
            onClick={() => {
              if (item.disabled || item.submenu) return
              onAction(item.key, assetIds)
              onClose()
            }}
          >
            <span>{item.label}</span>
            {item.submenu && !item.disabled ? (
              <span className="text-av-text-muted text-xs">▶</span>
            ) : item.shortcut ? (
              <span className="text-av-text-muted text-[11px] shrink-0">{item.shortcut}</span>
            ) : null}
          </button>

          {item.submenu === 'folders' && openSubmenu === 'folders' && submenuPos ? (
            <div
              className="av-context-menu-submenu fixed z-[10001]"
              style={{
                left: submenuPos.left,
                top: submenuPos.top,
                width: SUBMENU_WIDTH,
                maxHeight: SUBMENU_MAX_HEIGHT
              }}
            >
              {flatFolders.length === 0 ? (
                <p className="px-3 py-2 text-xs text-av-text-muted">{t('contextMenu.noFolders')}</p>
              ) : (
                flatFolders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm text-av-text-primary hover:bg-av-bg-hover truncate"
                    style={{ paddingLeft: 12 + f.depth * 14 }}
                    onClick={() => {
                      onAction('add-folder', assetIds, f.id)
                      onClose()
                    }}
                  >
                    {f.name}
                  </button>
                ))
              )}
            </div>
          ) : null}

          {item.submenu === 'libraries' && openSubmenu === 'libraries' && submenuPos ? (
            <div
              className="av-context-menu-submenu fixed z-[10001]"
              style={{
                left: submenuPos.left,
                top: submenuPos.top,
                width: SUBMENU_WIDTH,
                maxHeight: SUBMENU_MAX_HEIGHT
              }}
            >
              {otherLibraries.map((lib) => (
                <button
                  key={lib}
                  type="button"
                  title={lib}
                  className="w-full text-left px-3 py-1.5 text-sm text-av-text-primary hover:bg-av-bg-hover truncate"
                  onClick={() => {
                    onAction('add-library', assetIds, lib)
                    onClose()
                  }}
                >
                  {folderBasename(lib)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        )
      )}
    </div>,
    document.body
  )
}
