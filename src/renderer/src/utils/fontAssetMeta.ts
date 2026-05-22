import type { AssetItem } from '@/shared/types'
import { FONT_THUMB_SAMPLE_TEXT } from '@/shared/fontTypes'
import type { ParsedFontMetadata } from '@/shared/fontTypes'

export function parseFontMetadataFromAsset(asset: AssetItem | null | undefined): ParsedFontMetadata | null {
  if (!asset?.metadata) return null
  try {
    const parsed = JSON.parse(asset.metadata) as { font?: ParsedFontMetadata }
    return parsed.font ?? null
  } catch {
    return null
  }
}

export function fontFamilyLabel(asset: AssetItem, meta: ParsedFontMetadata | null): string {
  return meta?.familyName || asset.originalName || asset.filename || 'Font'
}

export function fontPreviewFamilyName(assetId: string): string {
  return `av-font-${assetId}`
}

export function defaultPreviewText(asset: AssetItem, meta: ParsedFontMetadata | null): string {
  return meta?.sampleText?.trim() || FONT_THUMB_SAMPLE_TEXT
}
