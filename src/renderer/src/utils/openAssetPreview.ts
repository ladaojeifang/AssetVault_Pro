import type { AssetItem } from '@/shared/types'
import {
  resolveAssetOpenAction,
  type AssetPreviewKind
} from '@/shared/assetPreviewRegistry'

export interface AssetPreviewOpeners {
  openFontPreview: (assetId: string) => void
  openModelPreview: (assetId: string) => void
  openSvgPreview: (assetId: string) => void
  openExrPreview: (assetId: string) => void
  openMarkdownPreview: (assetId: string) => void
}

export function openAssetPreview(
  kind: AssetPreviewKind,
  assetId: string,
  openers: AssetPreviewOpeners
): void {
  switch (kind) {
    case 'font':
      openers.openFontPreview(assetId)
      break
    case 'model':
      openers.openModelPreview(assetId)
      break
    case 'svg':
      openers.openSvgPreview(assetId)
      break
    case 'exr':
      openers.openExrPreview(assetId)
      break
    case 'markdown':
      openers.openMarkdownPreview(assetId)
      break
  }
}

/** double-click / 默认打开：全页预览或资源管理器。 */
export async function performAssetDefaultOpen(
  asset: AssetItem,
  openers: AssetPreviewOpeners
): Promise<void> {
  const action = resolveAssetOpenAction(asset)
  if (action === 'explorer') {
    const p = asset.resolvedFilePath ?? asset.filePath
    if (p) await window.assetVaultAPI.fs.openInExplorer(p)
    return
  }
  openAssetPreview(action, asset.id, openers)
}
