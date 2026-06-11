import type { CanvasNodeType, ConfigNodeType } from '../../../../shared/modeConfigTypes'

/** React Flow 节点 type（小写+下划线） */
export type FlowNodeType =
  | 'base_text'
  | 'base_image'
  | 'base_video'
  | 'base_audio'
  | 'generate_text'
  | 'generate_image'
  | 'generate_video'
  | 'generate_audio'
  | 'generate_storyboard'

export const GENERATE_FLOW_TYPES: FlowNodeType[] = [
  'generate_text',
  'generate_image',
  'generate_video',
  'generate_audio',
  'generate_storyboard'
]

export const BASE_FLOW_TYPES: FlowNodeType[] = [
  'base_text',
  'base_image',
  'base_video',
  'base_audio'
]

const FLOW_TO_CANVAS: Record<FlowNodeType, CanvasNodeType> = {
  generate_text: 'GENERATE_TEXT',
  generate_image: 'GENERATE_IMAGE',
  generate_video: 'GENERATE_VIDEO',
  generate_audio: 'GENERATE_AUDIO',
  generate_storyboard: 'GENERATE_STORYBOARD',
  base_text: 'BASE_TEXT',
  base_image: 'BASE_IMAGE',
  base_video: 'BASE_VIDEO',
  base_audio: 'BASE_AUDIO'
}

const CANVAS_TO_FLOW: Record<CanvasNodeType, FlowNodeType> = {
  BASE_TEXT: 'base_text',
  BASE_IMAGE: 'base_image',
  BASE_VIDEO: 'base_video',
  BASE_AUDIO: 'base_audio',
  GENERATE_TEXT: 'generate_text',
  GENERATE_IMAGE: 'generate_image',
  GENERATE_VIDEO: 'generate_video',
  GENERATE_AUDIO: 'generate_audio',
  GENERATE_STORYBOARD: 'generate_storyboard'
}

const LEGACY_TO_FLOW: Record<string, FlowNodeType> = {
  text: 'generate_text',
  image: 'generate_image',
  video: 'generate_video',
  reference: 'base_image',
  output: 'generate_image',
  prompt: 'base_text',
  provider: 'base_text',
  generator: 'generate_image'
}

export function flowTypeToCanvasNodeType(flowType: string | undefined): CanvasNodeType | null {
  if (!flowType || !isGenerateFlowType(flowType)) return null
  return FLOW_TO_CANVAS[flowType as FlowNodeType] as CanvasNodeType
}

export function flowTypeToConfigNodeType(flowType: string | undefined): ConfigNodeType | null {
  if (!flowType) return null
  const f = flowType as FlowNodeType
  return (FLOW_TO_CANVAS[f] as ConfigNodeType) ?? null
}

export function canvasNodeTypeToFlowType(canvas: CanvasNodeType): FlowNodeType {
  return CANVAS_TO_FLOW[canvas]
}

export function isGenerateFlowType(flowType: string | undefined): boolean {
  return GENERATE_FLOW_TYPES.includes(flowType as FlowNodeType)
}

export function isBaseFlowType(flowType: string | undefined): boolean {
  return BASE_FLOW_TYPES.includes(flowType as FlowNodeType)
}

export function legacyTypeToFlowType(type: string | undefined, data?: Record<string, unknown>): FlowNodeType {
  if (!type) return 'generate_image'
  if (type in LEGACY_TO_FLOW && !['image', 'reference', 'output'].includes(type)) {
    return LEGACY_TO_FLOW[type]
  }
  if (type === 'reference') return 'base_image'
  if (type === 'output') return 'generate_image'
  if (type === 'image') {
    if (data?.assetId && !data?.modelCode) return 'base_image'
    return 'generate_image'
  }
  return LEGACY_TO_FLOW[type] ?? 'generate_image'
}

export function flowTypeLabel(flowType: FlowNodeType): string {
  switch (flowType) {
    case 'generate_text':
      return '文本生成'
    case 'generate_image':
      return '图片生成'
    case 'generate_video':
      return '视频生成'
    case 'generate_audio':
      return '音频生成'
    case 'generate_storyboard':
      return '分镜生成'
    case 'base_text':
      return '文本素材'
    case 'base_image':
      return '图片素材'
    case 'base_video':
      return '视频素材'
    case 'base_audio':
      return '音频素材'
    default:
      return flowType
  }
}
