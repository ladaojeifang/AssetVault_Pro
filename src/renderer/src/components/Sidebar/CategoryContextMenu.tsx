import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import type { CategoryItem } from '@/shared/types'
import { DESTRUCTIVE_MENU_ITEM_CLASS } from '../../theme/destructiveActionClasses'

export type CategoryContextMenuState = {
  category: CategoryItem
  x: number
  y: number
} | null

const MENU_MIN_WIDTH = 184
const MENU_ITEM_HEIGHT = 36
const MENU_PAD = 8

export function CategoryContextMenu({
  state,
  onClose,
  onAction
}: {
  state: CategoryContextMenuState
  onClose: () => void
  onAction: (key: string, category: CategoryItem) => void
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
    const h = el?.offsetHeight ?? MENU_ITEM_HEIGHT * 3 + MENU_PAD
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

  if (!state) return null

  const { category } = state
  const items: Array<{
    key: string
    label: string
    danger?: boolean
  }> = [
    { key: 'edit', label: t('categoryMenu.edit') },
    { key: 'delete', label: t('categoryMenu.delete'), danger: true }
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
          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
            item.danger
              ? DESTRUCTIVE_MENU_ITEM_CLASS
              : item.key === 'edit'
                ? 'text-av-accent-blue hover:bg-av-bg-hover'
                : 'text-av-text-secondary hover:bg-av-bg-hover hover:text-av-text-primary'
          }`}
          onClick={() => {
            onAction(item.key, category)
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
