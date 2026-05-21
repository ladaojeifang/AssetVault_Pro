import type { Dispatch, SetStateAction } from 'react'
import type { Node } from '@xyflow/react'

const MOCK_DELAY_MS = 900

/** 简单判断是否以中文为主 */
function isMostlyCjk(text: string): boolean {
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0
  return cjk > text.replace(/\s/g, '').length * 0.2
}

function mockTranslation(source: string): string {
  if (isMostlyCjk(source)) {
    return (
      '[EN · Mock] A quiet rooftop in the rain. A robot from the future watches neon lights and distant stars, ' +
      'remembering a home it may never return to.'
    )
  }
  return (
    '【中文 · Mock】雨夜的城市屋顶，一个来自未来的机器人静静望着远处的霓虹与星星，' +
    '想起或许再也无法回去的故乡。'
  )
}

export async function runTextTranslateMock(
  nodeId: string,
  setNodes: Dispatch<SetStateAction<Node[]>>
): Promise<void> {
  let source = ''

  setNodes((prev) => {
    const n = prev.find((x) => x.id === nodeId)
    source = ((n?.data.content as string) ?? '').trim()
    if (!source) return prev
    return prev.map((x) =>
      x.id === nodeId ? { ...x, data: { ...x.data, translating: true } } : x
    )
  })

  if (!source) return

  await delay(MOCK_DELAY_MS)

  const translated = mockTranslation(source)

  setNodes((prev) =>
    prev.map((x) =>
      x.id === nodeId
        ? {
            ...x,
            data: {
              ...x.data,
              translating: false,
              contentTranslated: translated,
              status: 'success'
            }
          }
        : x
    )
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
