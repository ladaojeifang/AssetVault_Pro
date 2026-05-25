import React from 'react'

/** 列边界拖拽：默认隐形，悬停/拖拽时显示细线 */
export function ListColumnResizeHandle({
  onPointerDown,
  onDoubleClickReset
}: {
  onPointerDown: (e: React.MouseEvent) => void
  onDoubleClickReset?: () => void
}): React.ReactElement {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="拖拽调整列宽，双击恢复默认宽度"
      title="拖拽调整列宽 · 双击恢复默认"
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
