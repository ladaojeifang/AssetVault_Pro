import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FlowNodeType } from './canvasNodeTypes'
import { flowTypeLabel } from './canvasNodeTypes'
import VideoPreviewPlayer from './VideoPreviewPlayer'

type BaseAssetNodeProps = NodeProps & { flowType: FlowNodeType }

const BaseAssetNodeInner: React.FC<BaseAssetNodeProps> = ({ data, selected, flowType }) => {
  const displayIndex = Number(data.displayIndex) || 1
  const previewUrl = data.previewUrl as string | undefined
  const content = (data.content as string) ?? ''
  const label = (data.label as string) ?? ''

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      className={`ai-base-node ai-base-node--${flowType.replace('base_', '')} ${selected ? 'ai-base-node--selected' : ''}`}
      onDoubleClick={stop}
    >
      <Handle type="target" position={Position.Left} id="in" className="ai-flow-handle" />
      <Handle type="source" position={Position.Right} id="out" className="ai-flow-handle" />

      <div className="ai-base-node-header">
        <span className="ai-base-node-title">
          {flowTypeLabel(flowType)} {displayIndex}
        </span>
      </div>

      <div className="ai-base-node-body nodrag">
        {flowType === 'base_text' ? (
          content ? (
            <p className="ai-base-node-text">{content}</p>
          ) : (
            <div className="ai-base-node-empty">文本素材</div>
          )
        ) : flowType === 'base_video' ? (
          previewUrl ? (
            <VideoPreviewPlayer src={previewUrl} className="ai-video-preview--base" />
          ) : (
            <div className="ai-base-node-empty">视频素材</div>
          )
        ) : flowType === 'base_audio' ? (
          previewUrl ? (
            <audio src={previewUrl} className="ai-base-node-audio" controls />
          ) : (
            <div className="ai-base-node-empty">音频素材</div>
          )
        ) : previewUrl ? (
          <img src={previewUrl} alt="" className="ai-base-node-media" draggable={false} />
        ) : (
          <div className="ai-base-node-empty">图片素材</div>
        )}
        {label ? <span className="ai-base-node-label">{label}</span> : null}
      </div>
    </div>
  )
}

export const BaseTextNode = memo((p: NodeProps) => <BaseAssetNodeInner {...p} flowType="base_text" />)
BaseTextNode.displayName = 'BaseTextNode'

export const BaseImageNode = memo((p: NodeProps) => <BaseAssetNodeInner {...p} flowType="base_image" />)
BaseImageNode.displayName = 'BaseImageNode'

export const BaseVideoNode = memo((p: NodeProps) => <BaseAssetNodeInner {...p} flowType="base_video" />)
BaseVideoNode.displayName = 'BaseVideoNode'

export const BaseAudioNode = memo((p: NodeProps) => <BaseAssetNodeInner {...p} flowType="base_audio" />)
BaseAudioNode.displayName = 'BaseAudioNode'
