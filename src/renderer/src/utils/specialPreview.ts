import type { AssetPreviewKind } from '@/shared/assetPreviewRegistry'

/** Full-page asset preview kinds (font / 3D / SVG / EXR / Markdown). */
export type SpecialPreviewKind = AssetPreviewKind

export function getActiveSpecialPreview(ids: {
  fontPreviewAssetId: string | null
  modelPreviewAssetId: string | null
  svgPreviewAssetId: string | null
  exrPreviewAssetId: string | null
  markdownPreviewAssetId: string | null
}): SpecialPreviewKind | null {
  if (ids.fontPreviewAssetId) return 'font'
  if (ids.modelPreviewAssetId) return 'model'
  if (ids.svgPreviewAssetId) return 'svg'
  if (ids.exrPreviewAssetId) return 'exr'
  if (ids.markdownPreviewAssetId) return 'markdown'
  return null
}
