import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { notify } from '../Common/notify'

const TRY_ITEMS = [
  { key: 'write', label: '自己编写内容', icon: '✎' },
  { key: 'text2video', label: '文生视频', icon: '▶' },
  { key: 'img2prompt', label: '图片反推提示词', icon: '🖼' },
  { key: 'text2music', label: '文字生音乐', icon: '♪' }
] as const

export const TextFrameNode = memo(({ id, data, selected }: NodeProps) => {
  void id
  const displayIndex = Number(data.displayIndex) || 1
  const content = (data.content as string) ?? ''
  const hasContent = content.trim().length > 0

  const onTry = (key: string) => {
    if (key === 'write') {
      notify.info('在底部文本生成器中输入内容')
      return
    }
    notify.info(`${TRY_ITEMS.find((t) => t.key === key)?.label ?? key} 即将推出`)
  }

  return (
    <div
      className={`ai-media-frame ai-text-frame ${selected ? 'ai-media-frame--selected' : ''}`}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Handle type="target" position={Position.Left} id="in" className="ai-flow-handle !bg-violet-400" />
      <Handle type="source" position={Position.Right} id="out" className="ai-flow-handle !bg-violet-400" />

      <div className="ai-media-frame-header">
        <span className="ai-media-frame-icon" aria-hidden>
          ≡
        </span>
        <span className="ai-media-frame-title">文本节点 {displayIndex}</span>
      </div>

      <div className="ai-text-frame-body">
        {hasContent ? (
          <p className="ai-text-frame-content">{content}</p>
        ) : (
          <>
            <p className="ai-text-frame-try-label">尝试:</p>
            <ul className="ai-text-frame-try-list titlebar-no-drag">
              {TRY_ITEMS.map((item) => (
                <li key={item.key}>
                  <button type="button" className="ai-text-try-row" onClick={() => onTry(item.key)}>
                    <span className="ai-text-try-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
})
TextFrameNode.displayName = 'TextFrameNode'
