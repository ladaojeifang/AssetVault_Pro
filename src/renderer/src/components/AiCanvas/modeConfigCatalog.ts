import modeConfigJson from '../../../../../modeconfig.json'
import type {
  CanvasNodeType,
  ConfigNodeType,
  ModeConfigDependRule,
  ModeConfigGroup,
  ModeConfigModelEntry,
  ModeConfigParam,
  ModeConfigParamOption,
  ModeConfigResponse
} from '../../../../shared/modeConfigTypes'
import type { Edge, Node } from '@xyflow/react'
import { flowTypeToConfigNodeType, isGenerateFlowType } from './canvasNodeTypes'

const catalog = (modeConfigJson as ModeConfigResponse).data ?? []

const groupByCanvas = new Map<CanvasNodeType, ModeConfigGroup>()
for (const g of catalog) {
  groupByCanvas.set(g.canvasNodeType, g)
}

export function getModeConfigGroups(): ModeConfigGroup[] {
  return catalog
}

export function getModelsForCanvas(canvasNodeType: CanvasNodeType): ModeConfigModelEntry[] {
  const list = groupByCanvas.get(canvasNodeType)?.nodeConfig ?? []
  return [...list].sort((a, b) => a.sort - b.sort)
}

export function getModelEntry(
  canvasNodeType: CanvasNodeType,
  modelCode: string
): ModeConfigModelEntry | undefined {
  return getModelsForCanvas(canvasNodeType).find((m) => m.modelCode === modelCode)
}

export function getDefaultModel(canvasNodeType: CanvasNodeType): ModeConfigModelEntry | undefined {
  return getModelsForCanvas(canvasNodeType)[0]
}

export function buildDefaultParams(entry: ModeConfigModelEntry): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of entry.modelConfig.params) {
    if (p.default != null && p.default !== '') out[p.name] = String(p.default)
    else if (p.type === 'select' || p.type === 'radio') {
      const first = p.options?.[0]
      if (first) out[p.name] = String(first.value)
    } else if (p.type === 'switch') {
      out[p.name] = 'false'
    } else {
      out[p.name] = ''
    }
  }
  return out
}

export function getFooterParams(entry: ModeConfigModelEntry): ModeConfigParam[] {
  return entry.modelConfig.params.filter((p) => p.name !== 'prompt')
}

export function parseLengthRange(length: string | null | undefined): [number, number] | null {
  if (!length) return null
  const m = length.match(/\[(\d+),\s*(\d+)\]/)
  if (!m) return null
  return [Number(m[1]), Number(m[2])]
}

export function getUpstreamNodes(nodeId: string, nodes: Node[], edges: Edge[]): Node[] {
  const sourceIds = new Set(edges.filter((e) => e.target === nodeId).map((e) => e.source))
  return nodes.filter((n) => sourceIds.has(n.id))
}

export function countUpstreamByConfigTypes(
  nodeId: string,
  inValues: ConfigNodeType[],
  nodes: Node[],
  edges: Edge[]
): number {
  const upstream = getUpstreamNodes(nodeId, nodes, edges)
  return upstream.filter((n) => {
    const t = flowTypeToConfigNodeType(n.type)
    return t && inValues.includes(t)
  }).length
}

function rulePasses(rule: ModeConfigDependRule, nodeId: string, nodes: Node[], edges: Edge[]): boolean {
  if (rule.type !== 'inputNodeTypes') return true
  const count = countUpstreamByConfigTypes(nodeId, rule.inValues as ConfigNodeType[], nodes, edges)
  const range = parseLengthRange(rule.length)
  if (!range) return true
  return count >= range[0] && count <= range[1]
}

export function isReferModelOptionEnabled(
  option: ModeConfigParamOption,
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): boolean {
  const rules = option.dependOn ?? []
  if (rules.length === 0) return true
  return rules.every((r) => rulePasses(r, nodeId, nodes, edges))
}

export function getEnabledReferModelOptions(
  param: ModeConfigParam,
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): ModeConfigParamOption[] {
  return (param.options ?? []).filter((o) => isReferModelOptionEnabled(o, nodeId, nodes, edges))
}

export function canConnectNodes(
  sourceFlowType: string | undefined,
  targetFlowType: string | undefined,
  targetModelCode: string | undefined,
  targetCanvasType: CanvasNodeType | null
): boolean {
  if (!targetCanvasType || !isGenerateFlowType(targetFlowType)) return false
  const sourceConfig = flowTypeToConfigNodeType(sourceFlowType)
  if (!sourceConfig) return false

  const entry = targetModelCode
    ? getModelEntry(targetCanvasType, targetModelCode)
    : getDefaultModel(targetCanvasType)
  if (!entry) return false

  return entry.allowInputNodeTypes.includes(sourceConfig)
}

export function getBatchCount(params: Record<string, string>): number {
  const c = params.count
  if (!c) return 1
  const n = Number(c)
  return Number.isFinite(n) ? Math.min(8, Math.max(1, n)) : 1
}
