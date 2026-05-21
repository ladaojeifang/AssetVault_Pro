import React, { useEffect, useRef, useState } from 'react'
import type { FlowNodeType } from './canvasNodeTypes'
import { flowTypeLabel } from './canvasNodeTypes'

interface AiCanvasAddMenuProps {
  onAdd: (flowType: FlowNodeType) => void
}

const GENERATE_ITEMS: FlowNodeType[] = [
  'generate_text',
  'generate_image',
  'generate_video',
  'generate_audio',
  'generate_storyboard'
]

const BASE_ITEMS: FlowNodeType[] = ['base_text', 'base_image', 'base_video']

const ICON: Record<string, string> = {
  generate_text: '≡',
  generate_image: '🖼',
  generate_video: '▶',
  generate_audio: '♪',
  generate_storyboard: '▦',
  base_text: 'T',
  base_image: '🖼',
  base_video: '▶'
}

const AiCanvasAddMenu: React.FC<AiCanvasAddMenuProps> = ({ onAdd }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (t: FlowNodeType) => {
    onAdd(t)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="ai-canvas-tool-btn titlebar-no-drag"
        title="添加节点"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {open && (
        <div className="ai-add-menu titlebar-no-drag">
          <p className="ai-add-menu-section">生成节点</p>
          {GENERATE_ITEMS.map((t) => (
            <button key={t} type="button" onClick={() => pick(t)}>
              <span>{ICON[t]}</span> {flowTypeLabel(t)}
            </button>
          ))}
          <p className="ai-add-menu-section">素材节点</p>
          {BASE_ITEMS.map((t) => (
            <button key={t} type="button" onClick={() => pick(t)}>
              <span>{ICON[t]}</span> {flowTypeLabel(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default AiCanvasAddMenu
