/**
 * 全页资产预览路由配置（单一数据源）
 *
 * 顺序决定 double-click / 默认打开行为：先匹配者优先。
 */

export type AssetPreviewKind = 'font' | 'model' | 'svg' | 'exr' | 'markdown'

export type AssetOpenAction = AssetPreviewKind | 'explorer'

/** 详情面板 i18n key（detail 命名空间） */
export const ASSET_PREVIEW_DETAIL_LABEL_KEY: Record<AssetPreviewKind, string> = {
  font: 'previewFont',
  model: 'preview3d',
  svg: 'previewSvg',
  exr: 'previewExr',
  markdown: 'previewMarkdown'
}

/** 按优先级排列的预览类型 */
export const ASSET_PREVIEW_KIND_ORDER: readonly AssetPreviewKind[] = [
  'font',
  'model',
  'svg',
  'exr',
  'markdown'
]
