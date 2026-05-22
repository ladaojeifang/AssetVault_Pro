import React, { memo, useCallback, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type TextViewMode = 'edit' | 'preview'

const BaseTextNodeInner: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { updateNodeData } = useReactFlow()
  const displayIndex = Number(data.displayIndex) || 1
  const content = (data.content as string) ?? ''
  const [viewMode, setViewMode] = useState<TextViewMode>('edit')

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const onContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { content: e.target.value })
    },
    [id, updateNodeData]
  )

  return (
    <div
      className={`ai-base-node ai-base-node--text ${selected ? 'ai-base-node--selected' : ''}`}
      onDoubleClick={stop}
    >
      <Handle type="target" position={Position.Left} id="in" className="ai-flow-handle" />
      <Handle type="source" position={Position.Right} id="out" className="ai-flow-handle" />

      <div className="ai-base-node-header ai-base-node-header--text">
        <span className="ai-base-node-title">
          {data.fontFamilyName ? String(data.fontFamilyName) : `文本素材 ${displayIndex}`}
        </span>
        <div className="ai-base-node-text-tabs nodrag titlebar-no-drag" onPointerDown={stop}>
          <button
            type="button"
            className={`ai-base-node-text-tab ${viewMode === 'edit' ? 'is-active' : ''}`}
            onClick={() => setViewMode('edit')}
          >
            编辑
          </button>
          <button
            type="button"
            className={`ai-base-node-text-tab ${viewMode === 'preview' ? 'is-active' : ''}`}
            onClick={() => setViewMode('preview')}
          >
            预览
          </button>
        </div>
      </div>

      <div className="ai-base-node-body ai-base-node-body--text nodrag">
        {viewMode === 'edit' ? (
          <textarea
            className="ai-base-node-textarea nodrag nowheel nopan titlebar-no-drag"
            value={content}
            onChange={onContentChange}
            onPointerDown={stop}
            placeholder="输入文本素材，支持 Markdown…"
            spellCheck={false}
          />
        ) : content.trim() ? (
          <div className="ai-base-node-md nowheel nopan">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="ai-base-node-empty ai-base-node-empty--text">暂无内容</div>
        )}
      </div>
    </div>
  )
}

export const BaseTextNode = memo(BaseTextNodeInner)
BaseTextNode.displayName = 'BaseTextNode'
