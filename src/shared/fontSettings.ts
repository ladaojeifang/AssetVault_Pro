import { FONT_THUMB_SAMPLE_TEXT } from './fontTypes'

/** Bump when default thumb sample text or render pipeline changes — triggers incremental regen. */
export const FONT_THUMB_SAMPLE_VERSION = 2

export interface FontAppSettings {
  thumbSampleText: string
  thumbSampleVersion: number
}

export const DEFAULT_FONT_APP_SETTINGS: FontAppSettings = {
  thumbSampleText: FONT_THUMB_SAMPLE_TEXT,
  thumbSampleVersion: FONT_THUMB_SAMPLE_VERSION
}

/** Preset preview templates (Phase 3). */
export const FONT_PREVIEW_TEMPLATES: { id: string; label: string; text: string }[] = [
  { id: 'brand', label: '品牌', text: FONT_THUMB_SAMPLE_TEXT },
  { id: 'title', label: '海报标题', text: 'VibeShotClub\n视觉标题 AIGC' },
  { id: 'body', label: '正文段落', text: 'AIGC 创作让视觉表达更高效。Design with type.\n第二行中文正文预览效果。' },
  { id: 'latin', label: '英文', text: 'The quick brown fox jumps over the lazy dog.\n0123456789' },
  { id: 'cjk', label: '中文', text: '春眠不觉晓，处处闻啼鸟。\n夜来风雨声，花落知多少。' },
  { id: 'symbols', label: '符号', text: 'ABCDEFG abcdefg\n!@#$ %&* 「」【】（）' }
]

/** Tag name suggested for brand font pack folders. */
export const BRAND_FONT_PACK_TAG = 'brand-font-pack'
