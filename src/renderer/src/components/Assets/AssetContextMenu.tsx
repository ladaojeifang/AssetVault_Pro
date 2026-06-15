import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import type { AssetItem, CategoryItem, FolderItem } from '@/shared/types'
import { flattenFolderTree } from '../../utils/flattenFolderTree'
import { DESTRUCTIVE_MENU_ITEM_CLASS } from '../../theme/destructiveActionClasses'
import { getHotkeyAccelerator } from '@/shared/hotkeyRegistry'
import {
  canUseAssetAsFolderCover,
  supportsColorAnalysis
} from '@/shared/formatCapabilities'

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
  accent?: boolean
  shortcut?: string
  hint?: string
  submenu?: 'folders' | 'libraries' | 'categories'
}

type MenuSection = {
  id: string
  titleKey: 'sectionFile' | 'sectionEdit' | 'sectionThumbnail'
  items: MenuItem[]
}

const MENU_MIN_WIDTH = 220
const MENU_ITEM_HEIGHT = 36
const MENU_PAD = 8
const SUBMENU_WIDTH = 220
const SUBMENU_MAX_HEIGHT = 280

function folderBasename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1]! : p
}

function MenuIcon({ name }: { name: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'av-context-menu-item-icon'
  }

  switch (name) {
    case 'explorer':
      return (
        <svg {...common}>
          <path d="M3 7h5l2 2h11v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          <path d="M14 3h7v5" />
        </svg>
      )
    case 'add-folder':
      return (
        <svg {...common}>
          <path d="M3 7h6l2 2h10v10H3V7z" />
          <path d="M12 11v4M10 13h4" />
        </svg>
      )
    case 'add-category':
      return (
        <svg {...common}>
          <path d="M4 7h16v3H4V7z" />
          <path d="M6 13h12v4H6v-4z" />
          <path d="M12 10v7M9.5 12.5h5" />
        </svg>
      )
    case 'add-library':
      return (
        <svg {...common}>
          <path d="M4 7h5l2 2h9v10H4V7z" />
          <path d="M16 3v4M14 5h4" />
        </svg>
      )
    case 'set-cover':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="M21 15l-4.5-4.5L9 18" />
        </svg>
      )
    case 'rename':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      )
    case 'copy-files':
      return (
        <svg {...common}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )
    case 'copy-paths':
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      )
    case 'analyze-colors':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
        </svg>
      )
    case 'custom-thumb-file':
    case 'custom-thumb-clipboard':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="M21 15l-4-4-6 6" />
        </svg>
      )
    case 'refresh-thumbnail':
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 10-2.64 6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      )
    case 'delete':
      return (
        <svg {...common}>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      )
    default:
      return <span className="av-context-menu-item-icon" />
  }
}

function itemToneClass(item: MenuItem): string {
  if (item.disabled) return 'text-av-text-muted/45 cursor-not-allowed'
  if (item.danger) return DESTRUCTIVE_MENU_ITEM_CLASS
  if (item.accent) return 'text-av-accent-blue hover:bg-av-bg-hover'
  return 'text-av-text-primary hover:bg-av-bg-hover'
}

export function AssetContextMenu({
  state,
  folderTree,
  categories,
  currentFolderId,
  recentLibraries,
  recentLibraryDisplayNames,
  activeLibraryRoot,
  onClose,
  onAction
}: {
  state: AssetContextMenuState
  folderTree: FolderItem[]
  categories: CategoryItem[]
  currentFolderId: string | null
  recentLibraries: string[]
  recentLibraryDisplayNames?: string[]
  activeLibraryRoot: string
  onClose: () => void
  onAction: (key: string, assetIds: string[], extra?: string) => void
}) {
  const { t } = useTranslation('assets')
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [openSubmenu, setOpenSubmenu] = useState<'folders' | 'libraries' | 'categories' | null>(null)
  const [submenuPos, setSubmenuPos] = useState<{ left: number; top: number } | null>(null)

  const flatFolders = flattenFolderTree(folderTree)
  const otherLibraries = recentLibraries.filter(
    (p) => p.toLowerCase() !== activeLibraryRoot.toLowerCase()
  )

  const canSetCover =
    !!currentFolderId &&
    state != null &&
    canUseAssetAsFolderCover(state.primaryAsset.extension, state.primaryAsset.hasThumbnail)

  const canAnalyzeColors =
    state != null && supportsColorAnalysis(state.primaryAsset.extension)

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
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) onClose()
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

  const sections: MenuSection[] = [
    {
      id: 'file',
      titleKey: 'sectionFile',
      items: [
        { key: 'explorer', label: t('contextMenu.openExplorer') },
        { key: 'add-folder', label: t('contextMenu.addToFolder'), submenu: 'folders' },
        {
          key: 'add-category',
          label: t('contextMenu.setAssetType'),
          submenu: 'categories',
          disabled: categories.length === 0
        },
        {
          key: 'add-library',
          label: t('contextMenu.addToOtherLibrary'),
          submenu: 'libraries',
          disabled: otherLibraries.length === 0
        },
        { key: 'set-cover', label: t('contextMenu.setCover'), disabled: !canSetCover }
      ]
    },
    {
      id: 'edit',
      titleKey: 'sectionEdit',
      items: [
        { key: 'rename', label: t('contextMenu.rename'), disabled: multi, accent: true },
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
        }
      ]
    },
    {
      id: 'thumbnail',
      titleKey: 'sectionThumbnail',
      items: [
        {
          key: 'analyze-colors',
          label: multi
            ? t('contextMenu.reanalyzeColorMulti', { count: assetIds.length })
            : t('contextMenu.reanalyzeColor'),
          disabled: !canAnalyzeColors
        },
        {
          key: 'custom-thumb-file',
          label: t('contextMenu.customThumb'),
          hint: t('contextMenu.customThumbFromFile'),
          disabled: multi
        },
        {
          key: 'custom-thumb-clipboard',
          label: t('contextMenu.customThumb'),
          hint: t('contextMenu.customThumbFromClipboard'),
          disabled: multi
        },
        {
          key: 'refresh-thumbnail',
          label: t('contextMenu.refreshThumb'),
          shortcut: getHotkeyAccelerator('refresh-thumbnail')
        }
      ]
    }
  ]

  const deleteItem: MenuItem = {
    key: 'delete',
    label: multi ? t('contextMenu.deleteMulti', { count: assetIds.length }) : t('contextMenu.delete'),
    danger: true
  }

  function renderSubmenu(item: MenuItem) {
    if (item.submenu === 'folders' && openSubmenu === 'folders' && submenuPos) {
      return (
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
                className="av-context-menu-item text-av-text-primary hover:bg-av-bg-hover truncate"
                style={{ paddingLeft: 12 + f.depth * 14 }}
                onClick={() => {
                  onAction('add-folder', assetIds, f.id)
                  onClose()
                }}
              >
                <span className="av-context-menu-item-label">{f.name}</span>
              </button>
            ))
          )}
        </div>
      )
    }

    if (item.submenu === 'categories' && openSubmenu === 'categories' && submenuPos) {
      return (
        <div
          className="av-context-menu-submenu fixed z-[10001]"
          style={{
            left: submenuPos.left,
            top: submenuPos.top,
            width: SUBMENU_WIDTH,
            maxHeight: SUBMENU_MAX_HEIGHT
          }}
        >
          {categories.length === 0 ? (
            <p className="px-3 py-2 text-xs text-av-text-muted">{t('contextMenu.noCategories')}</p>
          ) : (
            categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="av-context-menu-item text-av-text-primary hover:bg-av-bg-hover truncate"
                onClick={() => {
                  onAction('add-category', assetIds, category.id)
                  onClose()
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                {category.icon ? (
                  <span className="text-xs shrink-0">{category.icon}</span>
                ) : null}
                <span className="av-context-menu-item-label flex-1 min-w-0">
                  {category.kind === 'system'
                    ? t(`fileTypes.${category.fileType ?? category.name}` as 'fileTypes.image', {
                        defaultValue: category.name
                      })
                    : category.name}
                </span>
              </button>
            ))
          )}
        </div>
      )
    }

    if (item.submenu === 'libraries' && openSubmenu === 'libraries' && submenuPos) {
      const nameMap = new Map<string, string>()
      if (recentLibraryDisplayNames) {
        for (let i = 0; i < recentLibraries.length; i++) {
          nameMap.set(
            recentLibraries[i]!.toLowerCase(),
            recentLibraryDisplayNames[i] ?? folderBasename(recentLibraries[i]!)
          )
        }
      }
      return (
        <div
          className="av-context-menu-submenu fixed z-[10001]"
          style={{
            left: submenuPos.left,
            top: submenuPos.top,
            width: SUBMENU_WIDTH,
            maxHeight: SUBMENU_MAX_HEIGHT
          }}
        >
          {otherLibraries.map((lib) => {
            const lbl = recentLibraryDisplayNames
              ? (nameMap.get(lib.toLowerCase()) ?? folderBasename(lib))
              : folderBasename(lib)
            return (
              <button
                key={lib}
                type="button"
                title={lib}
                className="av-context-menu-item text-av-text-primary hover:bg-av-bg-hover truncate"
                onClick={() => {
                  onAction('add-library', assetIds, lib)
                  onClose()
                }}
              >
                <span className="av-context-menu-item-label">{lbl}</span>
              </button>
            )
          })}
        </div>
      )
    }

    return null
  }

  function renderMenuItem(item: MenuItem) {
    const trailing = item.submenu && !item.disabled ? (
      <span className="av-context-menu-item-hint">▶</span>
    ) : item.shortcut ? (
      <span className="av-context-menu-item-hint">{item.shortcut}</span>
    ) : item.hint ? (
      <span className="av-context-menu-item-hint">{item.hint}</span>
    ) : null

    return (
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
          className={`av-context-menu-item ${itemToneClass(item)}`}
          onClick={() => {
            if (item.disabled || item.submenu) return
            onAction(item.key, assetIds)
            onClose()
          }}
        >
          <MenuIcon name={item.key} />
          <span className="av-context-menu-item-body">
            <span className="av-context-menu-item-label">{item.label}</span>
            {trailing}
          </span>
        </button>
        {renderSubmenu(item)}
      </div>
    )
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="av-context-menu fixed z-[10000]"
      style={{ left: pos?.left ?? state.x, top: pos?.top ?? state.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {sections.map((section) => (
        <div key={section.id}>
          <div className="av-context-menu-section-title" role="presentation">
            {t(`contextMenu.${section.titleKey}`)}
          </div>
          {section.items.map((item) => renderMenuItem(item))}
        </div>
      ))}

      <div className="av-context-menu-divider" role="separator" />
      {renderMenuItem(deleteItem)}
    </div>,
    document.body
  )
}
