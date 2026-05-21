import type { Dispatch, SetStateAction } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import type { AiGeneratorStatus } from '../../../../shared/aiCanvasTypes'
import type { CanvasNodeType } from '../../../../shared/modeConfigTypes'
import { renderOutputPlaceholderDataUrl } from '../../utils/outputPlaceholderPng'
import { canvasNodeTypeToFlowType } from './canvasNodeTypes'
import { canvasTypeFromNode, defaultGenNodeData, getPromptFromData, type GenNodeData } from './genNodeData'
import { getBatchCount } from './modeConfigCatalog'

const MOCK_DELAY_MS = 2000

export async function runNodeGenMock(
  nodeId: string,
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>
): Promise<void> {
  let canvasType: CanvasNodeType = 'GENERATE_IMAGE'
  let batchSize = 1
  let promptText = ''

  setNodes((prev) => {
    const n = prev.find((x) => x.id === nodeId)
    if (n) {
      canvasType = canvasTypeFromNode(n) ?? 'GENERATE_IMAGE'
      const d = n.data as unknown as GenNodeData
      batchSize = canvasType === 'GENERATE_TEXT' ? 1 : getBatchCount(d.params ?? {})
      promptText = getPromptFromData(d)
    }
    return prev.map((x) =>
      x.id === nodeId
        ? { ...x, data: { ...x.data, status: 'queued', progress: 0, errorMessage: null } }
        : x
    )
  })

  await delay(350)

  setNodes((prev) =>
    prev.map((x) =>
      x.id === nodeId ? { ...x, data: { ...x.data, status: 'running', progress: 12 } } : x
    )
  )

  const tick = setInterval(() => {
    setNodes((prev) =>
      prev.map((x) => {
        if (x.id !== nodeId || x.data.status !== 'running') return x
        const p = Math.min(92, Number(x.data.progress) + 14)
        return { ...x, data: { ...x.data, progress: p } }
      })
    )
  }, 260)

  await delay(MOCK_DELAY_MS)
  clearInterval(tick)

  setNodes((prev) => {
    const source = prev.find((x) => x.id === nodeId)
    if (!source) return prev

    const flowType = canvasNodeTypeToFlowType(canvasType)
    const extra: Node[] = []
    const baseX = source.position.x + 340
    const baseY = source.position.y

    const finishOne = (hue: number) => {
      if (canvasType === 'GENERATE_TEXT') {
        return {
          content:
            promptText ||
            '（Mock）雨夜的城市屋顶，一个来自未来的机器人静静望着远处的霓虹与星星。',
          contentTranslated: undefined,
          translating: false,
          previewUrl: null
        }
      }
      if (canvasType === 'GENERATE_VIDEO') {
        return { previewUrl: null, content: '' }
      }
      if (canvasType === 'GENERATE_AUDIO') {
        return { previewUrl: null, content: '（Mock）语音已生成' }
      }
      const previewUrl = renderOutputPlaceholderDataUrl(hue, 512)
      return { previewUrl, content: '' }
    }

    const primary = finishOne(200)
    let next = prev.map((x) =>
      x.id === nodeId
        ? {
            ...x,
            data: {
              ...x.data,
              status: 'success' as AiGeneratorStatus,
              progress: 100,
              ...primary
            }
          }
        : x
    )

    const srcData = source.data as unknown as GenNodeData

    for (let i = 1; i < batchSize; i++) {
      const hue = 200 + i * 40
      const r = finishOne(hue)
      const id = `${flowType}-batch-${uuidv4().slice(0, 8)}`
      const defaults = defaultGenNodeData(canvasType, (srcData.displayIndex ?? 1) + i)
      extra.push({
        id,
        type: flowType,
        position: { x: baseX, y: baseY + (i - 1) * 320 },
        data: {
          ...defaults,
          ...srcData,
          displayIndex: (srcData.displayIndex ?? 1) + i,
          status: 'success',
          progress: 100,
          params: { ...srcData.params },
          ...r,
          imported: false,
          assetId: null
        }
      })
    }

    if (extra.length > 0) {
      const newEdges: Edge[] = extra.map((n) => ({
        id: `e-${nodeId}-${n.id}`,
        source: nodeId,
        target: n.id,
        animated: true
      }))
      setEdges((eds) => [...eds, ...newEdges])
    }

    return [...next, ...extra]
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
