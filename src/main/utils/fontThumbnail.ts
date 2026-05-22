import { FONT_THUMB_SAMPLE_TEXT } from '@/shared/fontTypes'
import { renderFontPreviewPng, FONT_THUMB_CANVAS_SIZE } from './fontPreviewRender'

export { renderFontPreviewPng, FONT_THUMB_CANVAS_SIZE }
export { renderFontPreviewPngWithOptions } from './fontPreviewRender'

/** @deprecated use renderFontPreviewPng(filePath, text, ttcIndex) */
export function renderFontThumbPng(filePath: string, sampleText: string = FONT_THUMB_SAMPLE_TEXT, ttcIndex = 0) {
  return renderFontPreviewPng(filePath, sampleText, ttcIndex)
}
