import type { CSSProperties } from 'react'
import type { Edge, Node, Viewport } from '@xyflow/react'
import type { AiCanvasDocument, AiCanvasFlowEdge, AiCanvasFlowNode } from '../../../../shared/aiCanvasTypes'
import { stripLegacyWorkflowGraph } from './canvasWorkflow'

export function docToFlow(doc: AiCanvasDocument): { nodes: Node[]; edges: Edge[]; viewport: Viewport } {
  const nodes: Node[] = doc.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...n.data },
    parentId: n.parentId,
    style: n.style as CSSProperties | undefined
  }))
  const edges: Edge[] = doc.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined
  }))
  return {
    nodes,
    edges,
    viewport: { x: doc.viewport.x, y: doc.viewport.y, zoom: doc.viewport.zoom }
  }
}

const GENERATE_IMAGE_TYPES = new Set([
  'generate_image',
  'generate_storyboard',
  'image',
  'output'
])

function sanitizeNodeDataForPersist(type: string | undefined, data: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...data }
  delete copy.importing
  delete copy.modelLabel
  delete copy.resolution
  delete copy.aspect
  delete copy.batchSize
  delete copy.durationSec
  delete copy.modality

  if (type?.startsWith('base_') || type === 'reference') {
    delete copy.previewUrl
  }
  if (GENERATE_IMAGE_TYPES.has(type ?? '')) {
    delete copy.previewUrl
  }
  if (type === 'generate_video' || type === 'video' || type === 'base_video') {
    delete copy.previewUrl
  }
  if (type === 'generate_text' || type === 'text') {
    delete copy.content
    delete copy.contentTranslated
    delete copy.translating
  }
  return copy
}

export function flowToDoc(
  meta: Pick<AiCanvasDocument, 'id' | 'name' | 'createdAt' | 'updatedAt'>,
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport
): AiCanvasDocument {
  const { nodes: visibleNodes, edges: visibleEdges } = stripLegacyWorkflowGraph(nodes, edges)
  const flowNodes: AiCanvasFlowNode[] = visibleNodes.map((n) => {
    return {
      id: n.id,
      type: n.type as AiCanvasFlowNode['type'],
      position: n.position,
      data: sanitizeNodeDataForPersist(n.type, n.data as Record<string, unknown>),
      parentId: n.parentId,
      style: n.style as Record<string, unknown> | undefined
    }
  })
  const flowEdges: AiCanvasFlowEdge[] = visibleEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null
  }))
  return {
    ...meta,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    nodes: flowNodes,
    edges: flowEdges
  }
}
