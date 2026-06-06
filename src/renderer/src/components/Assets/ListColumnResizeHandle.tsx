import React from 'react'
import { useTranslation } from 'react-i18next'

/** 列边界拖拽：默认隐形，悬停/拖拽时显示细线 */
export function ListColumnResizeHandle({
  onPointerDown,
  onDoubleClickReset
}: {
  onPointerDown: (e: React.MouseEvent) => void
  onDoubleClickReset?: () => void
}): React.ReactElement {
  const { t } = useTranslation('assets')
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('columnResizeAria')}
      title={t('columnResize')}
      onMouseDown={onPointerDown}
      onDoubleClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDoubleClickReset?.()
      }}
      className="av-list-col-resize absolute right-0 top-1 bottom-1 z-10 w-[7px] translate-x-[3px] cursor-col-resize"
    />
  )
}
