import type { Edge, Node } from '@xyflow/react'
import type { GenModality } from './genModes'

export const WORKFLOW_PROMPT_ID = 'prompt-1'
export const WORKFLOW_PROVIDER_ID = 'provider-1'
export const WORKFLOW_GENERATOR_ID = 'gen-1'

const HIDDEN_TYPES = new Set(['prompt', 'provider', 'generator'])

export function isWorkflowNode(type: string | undefined): boolean {
  return HIDDEN_TYPES.has(type ?? '')
}

/** 移除旧版底部 Dock 工作流节点（prompt / provider / generator）及其连线 */
export function stripLegacyWorkflowGraph(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  const workflowIds = new Set(nodes.filter((n) => isWorkflowNode(n.type)).map((n) => n.id))
  if (workflowIds.size === 0) return { nodes, edges }
  return {
    nodes: nodes.filter((n) => !workflowIds.has(n.id)),
    edges: edges.filter((e) => !workflowIds.has(e.source) && !workflowIds.has(e.target))
  }
}

export function withHiddenWorkflowNodes(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    if (!isWorkflowNode(n.type)) return n
    return {
      ...n,
      hidden: true,
      selectable: false,
      draggable: false,
      connectable: true,
      style: { ...(n.style ?? {}), opacity: 0, width: 1, height: 1, pointerEvents: 'none' as const }
    }
  })
}

export function getPromptFromNodes(nodes: Node[]): string {
  const p = nodes.find((n) => n.id === WORKFLOW_PROMPT_ID || n.type === 'prompt')
  return (p?.data.text as string) ?? ''
}

export function getBatchFromNodes(nodes: Node[]): number {
  const g = nodes.find((n) => n.id === WORKFLOW_GENERATOR_ID || n.type === 'generator')
  return Math.min(8, Math.max(1, Number(g?.data.batchSize) || 1))
}

export function getModalityFromNodes(nodes: Node[]): GenModality {
  const g = nodes.find((n) => n.id === WORKFLOW_GENERATOR_ID)
  const m = g?.data.modality as GenModality | undefined
  if (m === 'text' || m === 'video' || m === 'image') return m
  return 'image'
}

export function ensureWorkflowGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  let nextNodes = [...nodes]
  let nextEdges = [...edges]

  const ensureNode = (id: string, type: string, data: Record<string, unknown>) => {
    if (!nextNodes.some((n) => n.id === id)) {
      nextNodes.push({ id, type, position: { x: -800, y: -800 }, data })
    }
  }

  ensureNode(WORKFLOW_PROMPT_ID, 'prompt', { text: '' })
  ensureNode(WORKFLOW_PROVIDER_ID, 'provider', {
    providerId: 'mock',
    label: 'AssetVault Mock'
  })
  ensureNode(WORKFLOW_GENERATOR_ID, 'generator', {
    status: 'draft',
    batchSize: 1,
    progress: 0,
    errorMessage: null,
    modality: 'image'
  })

  const link = (source: string, target: string, targetHandle: string) => {
    const edgeId = `e-${source}-${targetHandle}`
    if (!nextEdges.some((e) => e.id === edgeId)) {
      nextEdges.push({ id: edgeId, source, target, targetHandle })
    }
  }

  link(WORKFLOW_PROMPT_ID, WORKFLOW_GENERATOR_ID, 'prompt')
  link(WORKFLOW_PROVIDER_ID, WORKFLOW_GENERATOR_ID, 'provider')

  for (const ref of nextNodes.filter((n) => n.type === 'reference')) {
    link(ref.id, WORKFLOW_GENERATOR_ID, 'reference')
  }
  for (const t of nextNodes.filter((n) => n.type === 'text')) {
    link(t.id, WORKFLOW_GENERATOR_ID, 'reference')
  }
  for (const v of nextNodes.filter((n) => n.type === 'video')) {
    link(v.id, WORKFLOW_GENERATOR_ID, 'reference')
  }

  return { nodes: nextNodes, edges: nextEdges }
}

export function applyDockToWorkflow(
  nodes: Node[],
  dock: {
    modality: GenModality
    prompt: string
    batchSize: number
    modelLabel: string
    aspect: string
  }
): Node[] {
  return nodes.map((n) => {
    if (n.id === WORKFLOW_PROMPT_ID) {
      return { ...n, data: { ...n.data, text: dock.prompt, aspect: dock.aspect } }
    }
    if (n.id === WORKFLOW_PROVIDER_ID) {
      return { ...n, data: { ...n.data, label: dock.modelLabel } }
    }
    if (n.id === WORKFLOW_GENERATOR_ID) {
      return {
        ...n,
        data: { ...n.data, batchSize: dock.batchSize, modality: dock.modality }
      }
    }
    return n
  })
}

export function nextImageNodeIndex(nodes: Node[]): number {
  const imageNodes = nodes.filter((n) => n.type === 'reference' || n.type === 'output')
  const max = imageNodes.reduce((m, n) => Math.max(m, Number(n.data.displayIndex) || 0), 0)
  return max + 1
}

export function nextTextNodeIndex(nodes: Node[]): number {
  const list = nodes.filter((n) => n.type === 'text')
  const max = list.reduce((m, n) => Math.max(m, Number(n.data.displayIndex) || 0), 0)
  return max + 1
}

export function nextVideoNodeIndex(nodes: Node[]): number {
  const list = nodes.filter((n) => n.type === 'video')
  const max = list.reduce((m, n) => Math.max(m, Number(n.data.displayIndex) || 0), 0)
  return max + 1
}
