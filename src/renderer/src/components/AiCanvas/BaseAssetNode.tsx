import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { FlowNodeType } from './canvasNodeTypes'
import { flowTypeLabel } from './canvasNodeTypes'

type BaseAssetNodeProps = NodeProps & { flowType: FlowNodeType }

const BaseAssetNodeInner: React.FC<BaseAssetNodeProps> = ({ data, selected, flowType }) => {
  const displayIndex = Number(data.displayIndex) || 1
  const previewUrl = data.previewUrl as string | undefined
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
        {previewUrl ? (
          <audio src={previewUrl} className="ai-base-node-audio" controls />
        ) : (
          <div className="ai-base-node-empty">音频素材</div>
        )}
        {label ? <span className="ai-base-node-label">{label}</span> : null}
      </div>
    </div>
  )
}

export const BaseAudioNode = memo((p: NodeProps) => <BaseAssetNodeInner {...p} flowType="base_audio" />)
BaseAudioNode.displayName = 'BaseAudioNode'
