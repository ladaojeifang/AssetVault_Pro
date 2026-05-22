/** Default sample text rendered on font thumbnails (line 1 Latin, line 2 CJK). */
export const FONT_THUMB_SAMPLE_TEXT = 'VibeShotClub\nAIGC创作'

export interface FontGlyphSummary {
  char: string
  codePoint: number
  id: number
  advanceWidth: number
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null
}

export interface FontFaceSummary {
  index: number
  familyName: string
  subfamilyName: string | null
  fullName: string | null
  postscriptName: string | null
}

export interface FontUnicodeCoverage {
  totalCodePoints: number
  latinBasic: number
  latinExtended: number
  cjkUnified: number
  punctuation: number
  digits: number
}

export interface FontVariationAxisSummary {
  tag: string
  name: string
  min: number
  default: number
  max: number
}

export interface ParsedFontMetadata {
  familyName: string
  subfamilyName: string | null
  fullName: string | null
  postscriptName: string | null
  glyphCount: number
  unitsPerEm: number
  ascender: number | null
  descender: number | null
  lineGap: number | null
  format: string
  ttcIndex: number | null
  ttcFaceCount: number | null
  /** All faces when source is TTC / collection. */
  faces?: FontFaceSummary[]
  sampleText: string
  sampleGlyphs: FontGlyphSummary[]
  unicodeCoverage?: FontUnicodeCoverage | null
  variationAxes?: FontVariationAxisSummary[] | null
  /** Matches FONT_THUMB_SAMPLE_VERSION when thumb is up to date. */
  thumbSampleVersion?: number | null
}

export interface FontPreviewRenderRequest {
  filePath: string
  sampleText: string
  ttcIndex?: number
  canvasWidth?: number
  canvasHeight?: number
  fontSizePx?: number
  lineHeight?: number
  letterSpacingPx?: number
  textAlign?: 'left' | 'center' | 'right'
  backgroundColor?: string
  textColor?: string
}

export interface FontFamilyGroup {
  familyKey: string
  familyName: string
  assets: { id: string; filename: string; subfamilyName: string | null; ttcIndex: number | null }[]
}

export interface FontRegenerateFailure {
  assetId: string
  filename: string
  reason: string
}

export interface FontRegenerateResult {
  scanned: number
  updated: number
  skipped: number
  errors: number
  failures: FontRegenerateFailure[]
}
