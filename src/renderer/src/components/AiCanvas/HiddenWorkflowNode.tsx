import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

/** 工作流逻辑节点：不占画布视觉，仅保留连线锚点 */
export const HiddenPromptNode = memo(({ data }: NodeProps) => (
  <div className="w-px h-px overflow-hidden opacity-0 pointer-events-none">
    <Handle type="source" position={Position.Right} id="out" />
    <span className="sr-only">{(data.text as string) ?? ''}</span>
  </div>
))
HiddenPromptNode.displayName = 'HiddenPromptNode'

export const HiddenProviderNode = memo(() => (
  <div className="w-px h-px overflow-hidden opacity-0 pointer-events-none">
    <Handle type="source" position={Position.Right} id="out" />
  </div>
))
HiddenProviderNode.displayName = 'HiddenProviderNode'

export const HiddenGeneratorNode = memo(() => (
  <div className="w-px h-px overflow-hidden opacity-0 pointer-events-none">
    <Handle type="target" position={Position.Left} id="prompt" />
    <Handle type="target" position={Position.Left} id="reference" style={{ top: '50%' }} />
    <Handle type="target" position={Position.Left} id="provider" style={{ top: '80%' }} />
    <Handle type="source" position={Position.Right} id="out" />
  </div>
))
HiddenGeneratorNode.displayName = 'HiddenGeneratorNode'
