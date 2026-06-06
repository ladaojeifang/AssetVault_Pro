import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import type { FolderItem } from '@/shared/types'

export type FolderContextMenuState = {
  folder: FolderItem
  x: number
  y: number
} | null

const MENU_MIN_WIDTH = 184
const MENU_ITEM_HEIGHT = 36
const MENU_PAD = 8

export function FolderContextMenu({
  state,
  onClose,
  onAction,
  maxParentLevel
}: {
  state: FolderContextMenuState
  onClose: () => void
  onAction: (key: string, folder: FolderItem) => void
  maxParentLevel: number
}) {
  const { t } = useTranslation('sidebar')
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!state) {
      setPos(null)
      return
    }
    const el = menuRef.current
    const w = el?.offsetWidth ?? MENU_MIN_WIDTH
    const h = el?.offsetHeight ?? MENU_ITEM_HEIGHT * 5 + MENU_PAD
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

  if (!state) return null

  const { folder } = state
  const items: Array<{
    key: string
    label: string
    disabled?: boolean
    danger?: boolean
  }> = [
    {
      key: 'subfolder',
      label: t('folderMenu.newChild'),
      disabled: folder.level >= maxParentLevel
    },
    { key: 'rename', label: t('folderMenu.rename') },
    { key: 'icon', label: t('folderMenu.editIcon') },
    { key: 'color', label: t('folderMenu.editColor') },
    { key: 'delete', label: t('folderMenu.delete'), danger: true }
  ]

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="av-context-menu fixed z-[10000] min-w-[184px]"
      style={{
        left: pos?.left ?? state.x,
        top: pos?.top ?? state.y
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
            item.disabled
              ? 'text-av-text-muted/45 cursor-not-allowed'
              : item.danger
                ? 'text-red-400 hover:bg-red-500/15'
                : 'text-av-text-secondary hover:bg-av-bg-hover hover:text-av-text-primary'
          }`}
          onClick={() => {
            if (item.disabled) return
            onAction(item.key, folder)
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
