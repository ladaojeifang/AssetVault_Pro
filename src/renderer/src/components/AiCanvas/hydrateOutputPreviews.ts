import type { Node } from '@xyflow/react'
import { renderOutputPlaceholderDataUrl } from '../../utils/outputPlaceholderPng'

const OUTPUT_TYPES = new Set([
  'generate_image',
  'generate_storyboard',
  'image',
  'output'
])

/** 生成类图片节点：无 previewUrl 且已成功时按 hue 重建占位 */
export async function hydrateOutputPreviewUrls(nodes: Node[]): Promise<Node[]> {
  return nodes.map((n) => {
    if (!OUTPUT_TYPES.has(n.type ?? '')) return n
    if (n.data.previewUrl || n.data.imported) return n
    const hue = Number(n.data.hue) ?? 200
    if (n.data.status === 'success' || n.data.imported) {
      return {
        ...n,
        data: {
          ...n.data,
          previewUrl: renderOutputPlaceholderDataUrl(hue, 256)
        }
      }
    }
    return n
  })
}
