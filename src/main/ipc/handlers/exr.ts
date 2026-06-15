import { ipcMain } from 'electron'
import { existsSync } from 'fs'
import type { ExrPreviewRenderRequest } from '@/shared/exrTypes'
import { EXR_DEFAULT_LAYER_NAME } from '@/shared/exrTypes'
import { isExrExtension } from '@/shared/exrFormats'
import { getAssetById } from '../../services/assetQueryService'
import { resolveExrFileMetadata } from '../../utils/exrMetadata'
import { renderExrPreviewJpeg } from '../../services/exrPreviewRender'
import { storeExrPreviewJpeg } from '../../services/exrPreviewCache'
import { assertFiniteNumber, assertPlainObject, assertString } from '../ipcGuards'

function parseChannelToggle(raw: unknown): ExrPreviewRenderRequest['channels'] {
  assertPlainObject('channels', raw)
  const o = raw as Record<string, unknown>
  return {
    r: o.r === true,
    g: o.g === true,
    b: o.b === true,
    a: o.a === true
  }
}

async function resolveExrAbsPathForAsset(assetId: string): Promise<
  | { ok: true; abs: string }
  | { ok: false; error: string }
> {
  const asset = await getAssetById(assetId, { incrementViewCount: false })
  if (!asset) return { ok: false, error: '资产不存在' }
  if (!isExrExtension(asset.extension ?? '')) {
    return { ok: false, error: '不是 EXR 图像资产' }
  }

  const abs = asset.resolvedFilePath?.trim()
  if (!abs) return { ok: false, error: '无法解析 EXR 文件路径' }
  if (!existsSync(abs)) return { ok: false, error: 'EXR 文件不存在' }
  return { ok: true, abs }
}

export function handleExrOperations(ipc: typeof ipcMain): void {
  ipc.handle('exr:get-metadata', async (_event, assetId: unknown) => {
    assertString('assetId', assetId)
    const resolved = await resolveExrAbsPathForAsset(assetId)
    if (!resolved.ok) return { ok: false as const, error: resolved.error }

    const meta = await resolveExrFileMetadata(resolved.abs)
    if (!meta) {
      console.warn('[ExrIPC] metadata parse failed:', resolved.abs)
      return { ok: false as const, error: '无法解析 EXR 文件头' }
    }
    return { ok: true as const, metadata: meta }
  })

  ipc.handle('exr:render-preview', async (_event, req: unknown) => {
    assertPlainObject('req', req)
    const r = req as Record<string, unknown>
    assertString('req.assetId', r.assetId)
    assertString('req.layerName', r.layerName)
    assertFiniteNumber('req.exposure', r.exposure)
    const channels = parseChannelToggle(r.channels)

    const resolved = await resolveExrAbsPathForAsset(r.assetId as string)
    if (!resolved.ok) return { ok: false as const, error: resolved.error }

    const layerName = (r.layerName as string) || EXR_DEFAULT_LAYER_NAME
    const maxEdge = typeof r.maxEdge === 'number' ? r.maxEdge : undefined

    const result = await renderExrPreviewJpeg(resolved.abs, {
      layerName,
      channels,
      exposure: r.exposure as number,
      maxEdge
    })

    if (!result.jpeg?.length) {
      return {
        ok: false as const,
        error: result.error ?? '渲染失败',
        failureReason: result.failureReason
      }
    }

    return {
      ok: true as const,
      previewUrl: storeExrPreviewJpeg(result.jpeg),
      channelControlAvailable: result.channelControlAvailable,
      displayMode: result.displayMode
    }
  })
}
