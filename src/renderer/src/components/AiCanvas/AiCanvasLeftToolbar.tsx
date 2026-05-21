import React from 'react'
import type { FlowNodeType } from './canvasNodeTypes'
import AiCanvasAddMenu from './AiCanvasAddMenu'

interface AiCanvasLeftToolbarProps {
  onAddNode: (flowType: FlowNodeType) => void
  onSave: () => void
  onBack: () => void
  onDeleteSelected: () => void
  selectedNodeCount: number
}

const ToolBtn: React.FC<{
  title: string
  onClick?: () => void
  children: React.ReactNode
}> = ({ title, onClick, children }) => (
  <button type="button" className="ai-canvas-tool-btn titlebar-no-drag" title={title} onClick={onClick}>
    {children}
  </button>
)

const AiCanvasLeftToolbar: React.FC<AiCanvasLeftToolbarProps> = ({
  onAddNode,
  onSave,
  onBack,
  onDeleteSelected,
  selectedNodeCount
}) => {
  return (
    <div className="ai-canvas-left-toolbar titlebar-no-drag">
      <ToolBtn title="返回列表" onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </ToolBtn>
      <AiCanvasAddMenu onAdd={onAddNode} />
      <ToolBtn title="保存画布" onClick={onSave}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
          <path d="M17 21v-8H7v8M7 3v5h8" />
        </svg>
      </ToolBtn>
      <ToolBtn
        title={selectedNodeCount > 0 ? `删除选中节点 (${selectedNodeCount}) · Delete` : '删除选中节点 · Delete'}
        onClick={selectedNodeCount > 0 ? onDeleteSelected : undefined}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={selectedNodeCount > 0 ? '' : 'opacity-35'}
        >
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
      </ToolBtn>
      <div className="ai-canvas-tool-spacer" />
      <ToolBtn title="帮助">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
        </svg>
      </ToolBtn>
    </div>
  )
}

export default AiCanvasLeftToolbar
