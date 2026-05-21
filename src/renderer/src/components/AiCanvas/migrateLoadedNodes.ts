import type { Edge, Node } from '@xyflow/react'
import type { CanvasNodeType } from '../../../../shared/modeConfigTypes'
import { stripLegacyWorkflowGraph } from './canvasWorkflow'
import {
  flowTypeToCanvasNodeType,
  isBaseFlowType,
  isGenerateFlowType,
  legacyTypeToFlowType,
  type FlowNodeType
} from './canvasNodeTypes'
import {
  applyModelToNodeData,
  defaultGenNodeData,
  type GenNodeData
} from './genNodeData'
import { getDefaultModel, getModelEntry, getModelsForCanvas } from './modeConfigCatalog'

function migrateGenerateData(
  canvasNodeType: CanvasNodeType,
  d: Record<string, unknown>,
  displayIndex: number
): GenNodeData {
  let data = defaultGenNodeData(canvasNodeType, displayIndex)

  const legacyModel = (d.modelLabel as string) ?? ''
  const guessed = getModelsForCanvasGuess(canvasNodeType, legacyModel, d.modelCode as string | undefined)
  if (guessed) {
    data = applyModelToNodeData(data, canvasNodeType, guessed)
  }

  const params = { ...data.params, ...(d.params as Record<string, string> | undefined) }
  if ((d.prompt as string) ?? '') params.prompt = d.prompt as string
  if (d.resolution) params.resolution = String(d.resolution)
  if (d.aspect) params.aspectRatio = String(d.aspect)
  if (d.aspectRatio) params.aspectRatio = String(d.aspectRatio)
  if (d.batchSize != null && !params.count) params.count = String(d.batchSize)
  if (d.durationSec != null && !params.duration) params.duration = String(d.durationSec)

  return {
    ...data,
    params,
    previewUrl: (d.previewUrl as string | null) ?? null,
    content: (d.content as string) ?? '',
    contentTranslated: d.contentTranslated as string | undefined,
    translating: Boolean(d.translating),
    status: (d.status as GenNodeData['status']) ?? 'draft',
    progress: Number(d.progress) || 0,
    imported: Boolean(d.imported),
    importing: Boolean(d.importing),
    assetId: (d.assetId as string | null) ?? null,
    label: d.label as string | undefined,
    hue: d.hue as number | undefined
  }
}

function getModelsForCanvasGuess(
  canvas: CanvasNodeType,
  modelLabel: string,
  modelCode?: string
): string | undefined {
  if (modelCode && getModelEntry(canvas, modelCode)) return modelCode
  const hit = getModelsForCanvas(canvas).find(
    (m) => m.modelName === modelLabel || m.modelCode === modelLabel
  )
  return hit?.modelCode ?? getDefaultModel(canvas)?.modelCode
}

function migrateBaseData(d: Record<string, unknown>, displayIndex: number): Record<string, unknown> {
  return {
    displayIndex,
    previewUrl: d.previewUrl ?? null,
    content: (d.content as string) ?? '',
    assetId: d.assetId ?? null,
    label: d.label ?? ''
  }
}

/** 旧画布 → modeconfig 节点类型与数据结构 */
export function migrateLoadedNodes(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    const d = n.data as Record<string, unknown>
    const displayIndex = Number(d.displayIndex) || 1
    const flowType: FlowNodeType = legacyTypeToFlowType(n.type, d)

    if (isBaseFlowType(flowType)) {
      return {
        ...n,
        type: flowType,
        data: migrateBaseData(d, displayIndex)
      }
    }

    if (!isGenerateFlowType(flowType)) {
      return n
    }

    const canvasNodeType = flowTypeToCanvasNodeType(flowType)
    if (!canvasNodeType) return n

    return {
      ...n,
      type: flowType,
      data: migrateGenerateData(canvasNodeType, d, displayIndex)
    }
  })
}

export function migrateLoadedCanvas(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  return stripLegacyWorkflowGraph(migrateLoadedNodes(nodes), edges)
}
