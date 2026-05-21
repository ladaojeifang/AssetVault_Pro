import type { CanvasNodeType } from '../../../../shared/modeConfigTypes'
import type { FlowNodeType } from './canvasNodeTypes'
import { canvasNodeTypeToFlowType, flowTypeToCanvasNodeType } from './canvasNodeTypes'

/** @deprecated 使用 FlowNodeType / CanvasNodeType */
export type GenModality = 'text' | 'image' | 'video' | 'audio' | 'storyboard'

export function canvasTypeToModality(canvas: CanvasNodeType): GenModality {
  if (canvas === 'GENERATE_TEXT') return 'text'
  if (canvas === 'GENERATE_VIDEO') return 'video'
  if (canvas === 'GENERATE_AUDIO') return 'audio'
  if (canvas === 'GENERATE_STORYBOARD') return 'storyboard'
  return 'image'
}

export function flowTypeToModality(flow: FlowNodeType): GenModality | null {
  const canvas = flowTypeToCanvasNodeType(flow)
  if (!canvas) return null
  return canvasTypeToModality(canvas)
}

export function modalityToCanvasType(m: GenModality): CanvasNodeType {
  switch (m) {
    case 'text':
      return 'GENERATE_TEXT'
    case 'video':
      return 'GENERATE_VIDEO'
    case 'audio':
      return 'GENERATE_AUDIO'
    case 'storyboard':
      return 'GENERATE_STORYBOARD'
    default:
      return 'GENERATE_IMAGE'
  }
}

export function modalityToFlowType(m: GenModality): FlowNodeType {
  return canvasNodeTypeToFlowType(modalityToCanvasType(m))
}

export function modalityLabel(m: GenModality): string {
  if (m === 'text') return '文本'
  if (m === 'video') return '视频'
  if (m === 'audio') return '音频'
  if (m === 'storyboard') return '分镜'
  return '图片'
}
