/**
 * 资产预览路由：从扩展名 / fileType 解析应打开的全页预览。
 */

import {
  ASSET_PREVIEW_KIND_ORDER,
  type AssetOpenAction,
  type AssetPreviewKind
} from './assetPreviewCatalog'
import {
  isExrExtension,
  isMarkdownExtension,
  isModel3dPreviewExtension,
  isSvgExtension
} from './assetFormatRegistry'

export type { AssetOpenAction, AssetPreviewKind }
export { ASSET_PREVIEW_DETAIL_LABEL_KEY, ASSET_PREVIEW_KIND_ORDER } from './assetPreviewCatalog'

export interface AssetPreviewCandidate {
  fileType?: string | null
  extension?: string | null
}

const MATCHERS: Record<AssetPreviewKind, (asset: AssetPreviewCandidate) => boolean> = {
  font: (a) => a.fileType === 'font',
  model: (a) => a.fileType === '3d' && isModel3dPreviewExtension(a.extension ?? ''),
  svg: (a) => a.fileType === 'image' && isSvgExtension(a.extension ?? ''),
  exr: (a) => a.fileType === 'image' && isExrExtension(a.extension ?? ''),
  markdown: (a) => isMarkdownExtension(a.extension ?? '')
}

/** 资产是否支持指定全页预览。 */
export function canAssetPreview(asset: AssetPreviewCandidate, kind: AssetPreviewKind): boolean {
  return MATCHERS[kind](asset)
}

/** 解析全页预览类型；不支持则 `null`。 */
export function resolveAssetPreviewKind(asset: AssetPreviewCandidate): AssetPreviewKind | null {
  for (const kind of ASSET_PREVIEW_KIND_ORDER) {
    if (MATCHERS[kind](asset)) return kind
  }
  return null
}

/** double-click 默认行为：预览或打开资源管理器。 */
export function resolveAssetOpenAction(asset: AssetPreviewCandidate): AssetOpenAction {
  return resolveAssetPreviewKind(asset) ?? 'explorer'
}

/** 资产可触发的全部预览类型（通常 0–1 个；字体可与其它类型互斥）。 */
export function listAssetPreviewKinds(asset: AssetPreviewCandidate): AssetPreviewKind[] {
  return ASSET_PREVIEW_KIND_ORDER.filter((kind) => MATCHERS[kind](asset))
}

/** @deprecated Use {@link canAssetPreview}(asset, 'model') */
export function canModel3dPreview(asset: AssetPreviewCandidate): boolean {
  return canAssetPreview(asset, 'model')
}
