/** AI 无限画布 — 节点图持久化与 IPC 共享类型 */

export type AiGeneratorStatus = 'draft' | 'queued' | 'running' | 'success' | 'failed'

/** React Flow 节点 type（与 modeconfig 对齐） */
export type AiCanvasNodeKind =
  | 'base_text'
  | 'base_image'
  | 'base_video'
  | 'base_audio'
  | 'generate_text'
  | 'generate_image'
  | 'generate_video'
  | 'generate_audio'
  | 'generate_storyboard'
  /** 旧版兼容 */
  | 'text'
  | 'image'
  | 'video'
  | 'reference'
  | 'output'
  | 'prompt'
  | 'provider'
  | 'generator'
  | 'frame'

export interface AiCanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface AiCanvasFlowNode {
  id: string
  type: AiCanvasNodeKind
  position: { x: number; y: number }
  data: Record<string, unknown>
  parentId?: string
  style?: Record<string, unknown>
}

export interface AiCanvasFlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export interface AiCanvasDocument {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  viewport: AiCanvasViewport
  nodes: AiCanvasFlowNode[]
  edges: AiCanvasFlowEdge[]
}

export interface AiCanvasListItem {
  id: string
  name: string
  updatedAt: string
  nodeCount: number
}
