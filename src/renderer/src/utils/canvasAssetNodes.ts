import type { Node } from '@xyflow/react'
import type { AssetItem } from '@/shared/types'
import type { FlowNodeType } from '../components/AiCanvas/canvasNodeTypes'
import { createFlowNodeId } from '../components/AiCanvas/genNodeData'
import { parseFontMetadataFromAsset, fontFamilyLabel } from './fontAssetMeta'
import { FONT_THUMB_SAMPLE_TEXT } from '@/shared/fontTypes'
import { toBlobPart } from '@/shared/blobUtils'
import { resolveCanvasFlowType, resolveFormatCapabilities } from '@/shared/formatCapabilities'

const MEDIA_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  m4v: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif'
}

function mimeFromFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return MEDIA_MIME[ext] ?? 'application/octet-stream'
}

/** 本地媒体用 blob: URL，避免 http 页面加载 file: 失败或被 CSP 拦截 */
export async function resolveMediaBlobUrl(asset: AssetItem): Promise<string | null> {
  const path = asset.resolvedFilePath ?? asset.filePath
  if (!path) return null
  try {
    const bytes = await window.assetVaultAPI.fs.readFileBytes(path)
    const blob = new Blob([toBlobPart(bytes)], {
      type: asset.mimeType || mimeFromFilename(asset.originalName || asset.filename || path)
    })
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

export function revokePreviewUrlIfBlob(url: string | null | undefined): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

export function revokePreviewUrlsFromNodes(nodes: Node[]): void {
  for (const n of nodes) {
    revokePreviewUrlIfBlob(n.data.previewUrl as string | undefined)
  }
}

export async function resolveAssetPreviewUrl(asset: AssetItem): Promise<string | null> {
  const pipeline = resolveFormatCapabilities(asset.extension).importPipeline
  if (pipeline === 'video' || pipeline === 'audio') {
    return resolveMediaBlobUrl(asset)
  }

  try {
    const thumb = await window.assetVaultAPI.assets.getThumbnail(asset.id)
    if (thumb) return thumb
  } catch {
    /* ignore */
  }

  if (pipeline === 'image') {
    return resolveMediaBlobUrl(asset)
  }

  return null
}

function nextIndex(nodes: Node[], type: string): number {
  const list = nodes.filter((n) => n.type === type)
  return list.reduce((m, n) => Math.max(m, Number(n.data.displayIndex) || 0), 0) + 1
}

/** 从素材库拖入 → 按文件类型创建 BASE 素材节点 */
export async function buildBaseAssetNodesFromAssetIds(
  assetIds: string[],
  origin: { x: number; y: number },
  existingNodes: Node[] = []
): Promise<{ nodes: Node[]; skipped: number }> {
  const nodes: Node[] = []
  const stamp = Date.now()
  let skipped = 0
  const indexByType = new Map<string, number>()

  const nextForType = (flowType: FlowNodeType): number => {
    const cur = indexByType.get(flowType) ?? nextIndex(existingNodes, flowType)
    indexByType.set(flowType, cur + 1)
    return cur
  }

  for (let i = 0; i < assetIds.length; i++) {
    const assetId = assetIds[i]
    const asset = (await window.assetVaultAPI.assets.getById(assetId)) as AssetItem | null
    if (!asset) {
      skipped++
      continue
    }

    const flowType = resolveCanvasFlowType(asset.extension)
    if (!flowType) {
      skipped++
      continue
    }

    const displayIndex = nextForType(flowType)
    const previewUrl =
      flowType === 'base_text' ? null : await resolveAssetPreviewUrl(asset)

    let content = ''
    let fontAssetId: string | undefined
    let fontFamilyName: string | undefined
    if (resolveFormatCapabilities(asset.extension).importPipeline === 'font') {
      const meta = parseFontMetadataFromAsset(asset)
      content = meta?.sampleText?.trim() || FONT_THUMB_SAMPLE_TEXT
      fontAssetId = asset.id
      fontFamilyName = fontFamilyLabel(asset, meta)
    }

    nodes.push({
      id: `${flowType}-${asset.id}-${stamp}-${i}`,
      type: flowType,
      position: { x: origin.x + i * 48, y: origin.y + i * 48 },
      data: {
        displayIndex,
        previewUrl,
        assetId: asset.id,
        label: fontFamilyName ?? asset.originalName ?? asset.filename,
        content,
        ...(fontAssetId ? { fontAssetId, fontFamilyName } : {})
      }
    })
  }

  return { nodes, skipped }
}

/** 从素材库拖入 → BASE_IMAGE 素材节点（可连到生成节点） */
export async function buildBaseImageNodesFromAssetIds(
  assetIds: string[],
  origin: { x: number; y: number },
  existingNodes: Node[] = []
): Promise<Node[]> {
  const { nodes } = await buildBaseAssetNodesFromAssetIds(assetIds, origin, existingNodes)
  return nodes.filter((n) => n.type === 'base_image')
}

/** @deprecated */
export const buildImageNodesFromAssetIds = buildBaseImageNodesFromAssetIds
export const buildReferenceNodesFromAssetIds = buildBaseImageNodesFromAssetIds

export async function hydrateReferencePreviewUrls(nodes: Node[]): Promise<Node[]> {
  const out: Node[] = []
  for (const n of nodes) {
    const isAsset =
      n.type === 'base_image' ||
      n.type === 'base_video' ||
      n.type === 'image' ||
      n.type === 'reference' ||
      n.type === 'video' ||
      n.type === 'generate_image' ||
      n.type === 'generate_video'
    if (!isAsset) {
      out.push(n)
      continue
    }
    const assetId = n.data.assetId as string | undefined
    const previewUrl = n.data.previewUrl as string | null | undefined
    const needsHydrate =
      assetId &&
      (!previewUrl ||
        previewUrl.startsWith('file:') ||
        previewUrl.startsWith('blob:'))
    if (!needsHydrate) {
      out.push(n)
      continue
    }
    const asset = (await window.assetVaultAPI.assets.getById(assetId)) as AssetItem | null
    if (!asset) {
      out.push(n)
      continue
    }
    revokePreviewUrlIfBlob(previewUrl)
    out.push({
      ...n,
      data: {
        ...n.data,
        previewUrl: await resolveAssetPreviewUrl(asset),
        label: (n.data.label as string) || asset.originalName || asset.filename
      }
    })
  }
  return out
}

export function createEmptyBaseTextNode(position: { x: number; y: number }, displayIndex: number): Node {
  return {
    id: createFlowNodeId('base_text'),
    type: 'base_text',
    position,
    data: { displayIndex, content: '', label: '' }
  }
}
