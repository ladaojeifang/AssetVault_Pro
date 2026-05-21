import type { AiGeneratorStatus } from '../../../../shared/aiCanvasTypes'
import type { CanvasNodeType } from '../../../../shared/modeConfigTypes'
import {
  buildDefaultParams,
  getDefaultModel,
  getModelEntry
} from './modeConfigCatalog'
import { canvasNodeTypeToFlowType, flowTypeToCanvasNodeType, legacyTypeToFlowType } from './canvasNodeTypes'
import type { FlowNodeType } from './canvasNodeTypes'

/** 生成节点 — 单卡数据结构（对齐 modeconfig） */
export interface GenNodeData {
  displayIndex?: number
  canvasNodeType: CanvasNodeType
  modelCode: string
  modelName: string
  /** modeconfig params（含 prompt、resolution、count 等） */
  params: Record<string, string>
  status: AiGeneratorStatus
  progress: number
  errorMessage?: string | null
  previewUrl?: string | null
  content?: string
  contentTranslated?: string
  translating?: boolean
  hue?: number
  imported?: boolean
  importing?: boolean
  assetId?: string | null
  label?: string
}

export function defaultGenNodeData(
  canvasNodeType: CanvasNodeType,
  displayIndex: number
): GenNodeData {
  const entry = getDefaultModel(canvasNodeType)
  const modelCode = entry?.modelCode ?? 'MOCK'
  const modelName = entry?.modelName ?? 'Mock'
  const params = entry ? buildDefaultParams(entry) : { prompt: '' }

  return {
    displayIndex,
    canvasNodeType,
    modelCode,
    modelName,
    params,
    status: 'draft',
    progress: 0,
    previewUrl: null,
    content: '',
    contentTranslated: undefined,
    translating: false
  }
}

export function defaultGenNodeDataForFlow(
  flowType: FlowNodeType,
  displayIndex: number
): GenNodeData {
  const canvas = flowTypeToCanvasNodeType(flowType)
  if (!canvas) {
    return defaultGenNodeData('GENERATE_IMAGE', displayIndex)
  }
  return defaultGenNodeData(canvas, displayIndex)
}

export function applyModelToNodeData(
  data: GenNodeData,
  canvasNodeType: CanvasNodeType,
  modelCode: string
): GenNodeData {
  const entry = getModelEntry(canvasNodeType, modelCode)
  if (!entry) return data
  return {
    ...data,
    canvasNodeType,
    modelCode: entry.modelCode,
    modelName: entry.modelName,
    params: buildDefaultParams(entry)
  }
}

export function getPromptFromData(data: GenNodeData): string {
  return data.params.prompt ?? ''
}

export function flowTypeFromNode(node: { type?: string; data: Record<string, unknown> }): FlowNodeType {
  return legacyTypeToFlowType(node.type, node.data as Record<string, unknown>)
}

export function canvasTypeFromNode(node: {
  type?: string
  data: Record<string, unknown>
}): CanvasNodeType | null {
  const d = node.data as Partial<GenNodeData>
  if (d.canvasNodeType) return d.canvasNodeType
  return flowTypeToCanvasNodeType(legacyTypeToFlowType(node.type, node.data as Record<string, unknown>))
}

/** @deprecated use flowTypeFromNode */
export function nodeTypeToGenModality(type: string | undefined): 'text' | 'image' | 'video' {
  const flow = legacyTypeToFlowType(type)
  if (flow === 'generate_text') return 'text'
  if (flow === 'generate_video') return 'video'
  return 'image'
}

export function createFlowNodeId(flowType: FlowNodeType): string {
  return `${flowType}-${Date.now()}`
}

export function flowTypeForNewNode(canvasNodeType: CanvasNodeType): FlowNodeType {
  return canvasNodeTypeToFlowType(canvasNodeType)
}
