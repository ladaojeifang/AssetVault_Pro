import type { Dispatch, SetStateAction } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import type { AiGeneratorStatus } from '../../../../shared/aiCanvasTypes'
import { renderOutputPlaceholderDataUrl } from '../../utils/outputPlaceholderPng'
import { nextImageNodeIndex, nextTextNodeIndex, nextVideoNodeIndex } from './canvasWorkflow'
import type { GenModality } from './genModes'

const MOCK_DELAY_MS = 2200

export async function runMockGenerator(
  generatorId: string,
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>
): Promise<void> {
  const setGenStatus = (status: AiGeneratorStatus, extra: Record<string, unknown> = {}) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === generatorId
          ? { ...n, data: { ...n.data, status, ...extra } }
          : n
      )
    )
  }

  let batchSize = 1
  let modality: GenModality = 'image'
  let promptText = ''

  setNodes((prev) => {
    const gen = prev.find((n) => n.id === generatorId && n.type === 'generator')
    if (gen) {
      batchSize = Number(gen.data.batchSize) || 1
      modality = (gen.data.modality as GenModality) || 'image'
    }
    const prompt = prev.find((n) => n.id === 'prompt-1' || n.type === 'prompt')
    promptText = (prompt?.data.text as string) ?? ''
    return prev
  })

  setGenStatus('queued', { progress: 0, errorMessage: null })
  await delay(400)
  setGenStatus('running', { progress: 10 })

  const tick = setInterval(() => {
    setNodes((prev) => {
      const g = prev.find((n) => n.id === generatorId)
      if (!g || g.data.status !== 'running') return prev
      const p = Math.min(95, Number(g.data.progress) + 12)
      return prev.map((n) =>
        n.id === generatorId ? { ...n, data: { ...n.data, progress: p } } : n
      )
    })
  }, 280)

  await delay(MOCK_DELAY_MS)
  clearInterval(tick)

  setNodes((prev) => {
    const genNode = prev.find((n) => n.id === generatorId)
    if (!genNode) return prev

    const anchor =
      prev.find((n) => n.type === 'reference' || n.type === 'text' || n.type === 'video') ??
      genNode
    const baseX = anchor.position.x + 360
    const baseY = anchor.position.y

    const outputNodes: Node[] = []

    if (modality === 'text') {
      let idx = nextTextNodeIndex(prev)
      for (let i = 0; i < batchSize; i++) {
        const id = `text-out-${uuidv4().slice(0, 8)}`
        outputNodes.push({
          id,
          type: 'text',
          position: { x: baseX, y: baseY + i * 280 },
          data: {
            displayIndex: idx++,
            content: promptText || '（Mock 生成文本）这是一个来自画布的示例故事片段…'
          }
        })
      }
    } else if (modality === 'video') {
      let idx = nextVideoNodeIndex(prev)
      for (let i = 0; i < batchSize; i++) {
        const id = `video-out-${uuidv4().slice(0, 8)}`
        outputNodes.push({
          id,
          type: 'video',
          position: { x: baseX + i * 320, y: baseY },
          data: { displayIndex: idx++, previewUrl: null, status: 'mock' }
        })
      }
    } else {
      let idx = nextImageNodeIndex(prev)
      for (let i = 0; i < batchSize; i++) {
        const id = `out-${uuidv4().slice(0, 8)}`
        const hue = 180 + i * 35
        outputNodes.push({
          id,
          type: 'output',
          position: { x: baseX + (i % 2) * 300, y: baseY + Math.floor(i / 2) * 320 },
          data: {
            displayIndex: idx++,
            hue,
            previewUrl: renderOutputPlaceholderDataUrl(hue, 256),
            imported: false,
            assetId: null
          }
        })
      }
    }

    const outputEdges: Edge[] = outputNodes.map((o) => ({
      id: `e-${generatorId}-${o.id}`,
      source: generatorId,
      sourceHandle: 'out',
      target: o.id,
      targetHandle: o.type === 'output' ? 'in' : 'in'
    }))

    setEdges((eds) => [...eds, ...outputEdges])

    return prev
      .map((n) =>
        n.id === generatorId
          ? { ...n, data: { ...n.data, status: 'success' as AiGeneratorStatus, progress: 100 } }
          : n
      )
      .concat(outputNodes)
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
