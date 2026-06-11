import fontkit from 'fontkit'
import type { Font, FontCollection } from 'fontkit'
import { extname } from 'path'
import { FONT_THUMB_SAMPLE_VERSION } from '@/shared/fontSettings'
import { FONT_THUMB_SAMPLE_TEXT } from '@/shared/fontTypes'
import type {
  FontFaceSummary,
  FontGlyphSummary,
  FontUnicodeCoverage,
  FontVariationAxisSummary,
  ParsedFontMetadata
} from '@/shared/fontTypes'

function isFontCollection(doc: Font | FontCollection): doc is FontCollection {
  return typeof (doc as FontCollection).fonts !== 'undefined' && Array.isArray((doc as FontCollection).fonts)
}

function faceToSummary(face: Font, index: number): FontFaceSummary {
  return {
    index,
    familyName: face.familyName || 'Unknown',
    subfamilyName: face.subfamilyName ?? null,
    fullName: face.fullName ?? null,
    postscriptName: face.postscriptName ?? null
  }
}

export function listFontFacesFromFile(filePath: string): FontFaceSummary[] {
  try {
    const doc = fontkit.openSync(filePath)
    if (isFontCollection(doc)) {
      return doc.fonts.map((face: Font, index: number) => faceToSummary(face, index))
    }
    return [faceToSummary(doc as Font, 0)]
  } catch (error) {
    console.error(`[Font] listFontFacesFromFile failed ${filePath}:`, error)
    return []
  }
}

export function openFontFaceFromFile(
  filePath: string,
  ttcIndex = 0
): {
  face: Font
  ttcIndex: number | null
  ttcFaceCount: number | null
} | null {
  try {
    const doc = fontkit.openSync(filePath)
    if (isFontCollection(doc)) {
      if (!doc.fonts.length) return null
      const idx = Math.min(Math.max(0, ttcIndex), doc.fonts.length - 1)
      return { face: doc.fonts[idx], ttcIndex: idx, ttcFaceCount: doc.fonts.length }
    }
    return { face: doc as Font, ttcIndex: null, ttcFaceCount: null }
  } catch (error) {
    console.error(`[Font] openFontFaceFromFile failed ${filePath}:`, error)
    return null
  }
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeBBox(bbox: unknown): FontGlyphSummary['bbox'] {
  if (!bbox || typeof bbox !== 'object') return null
  const b = bbox as Record<string, unknown>
  return {
    minX: toFiniteNumber(b.minX),
    minY: toFiniteNumber(b.minY),
    maxX: toFiniteNumber(b.maxX),
    maxY: toFiniteNumber(b.maxY)
  }
}

export function analyzeUnicodeCoverage(face: Font): FontUnicodeCoverage {
  const set: number[] = []
  try {
    const cs = (face as Font & { characterSet?: number[] }).characterSet
    if (Array.isArray(cs)) set.push(...cs)
  } catch {
    /* optional */
  }

  let latinBasic = 0
  let latinExtended = 0
  let cjkUnified = 0
  let punctuation = 0
  let digits = 0

  for (const cp of set) {
    if (cp >= 0x30 && cp <= 0x39) digits++
    else if (cp >= 0x41 && cp <= 0x7a) latinBasic++
    else if (cp >= 0x80 && cp <= 0x24f) latinExtended++
    else if (cp >= 0x4e00 && cp <= 0x9fff) cjkUnified++
    else if (cp >= 0x2000 && cp <= 0x206f) punctuation++
  }

  return {
    totalCodePoints: set.length,
    latinBasic,
    latinExtended,
    cjkUnified,
    punctuation,
    digits
  }
}

export function parseVariationAxes(face: Font): FontVariationAxisSummary[] {
  try {
    const axes = (face as Font & { variationAxes?: Record<string, { name?: string; min?: number; default?: number; max?: number }> })
      .variationAxes
    if (!axes || typeof axes !== 'object') return []
    return Object.entries(axes).map(([tag, axis]) => {
      const a = axis as { name?: string; min?: number; default?: number; max?: number }
      return {
        tag,
        name: a.name ?? tag,
        min: toFiniteNumber(a.min),
        default: toFiniteNumber(a.default),
        max: toFiniteNumber(a.max)
      }
    })
  } catch {
    return []
  }
}

/** Strip fontkit lazy refs — safe for JSON.stringify / SQLite. */
export function sanitizeFontMetadata(meta: ParsedFontMetadata): ParsedFontMetadata {
  return {
    familyName: String(meta.familyName ?? 'Unknown'),
    subfamilyName: meta.subfamilyName != null ? String(meta.subfamilyName) : null,
    fullName: meta.fullName != null ? String(meta.fullName) : null,
    postscriptName: meta.postscriptName != null ? String(meta.postscriptName) : null,
    glyphCount: toFiniteNumber(meta.glyphCount),
    unitsPerEm: toFiniteNumber(meta.unitsPerEm, 1000),
    ascender: meta.ascender != null ? toFiniteNumber(meta.ascender) : null,
    descender: meta.descender != null ? toFiniteNumber(meta.descender) : null,
    lineGap: meta.lineGap != null ? toFiniteNumber(meta.lineGap) : null,
    format: String(meta.format ?? 'unknown'),
    ttcIndex: meta.ttcIndex != null ? toFiniteNumber(meta.ttcIndex) : null,
    ttcFaceCount: meta.ttcFaceCount != null ? toFiniteNumber(meta.ttcFaceCount) : null,
    faces: meta.faces?.map((f) => ({
      index: toFiniteNumber(f.index),
      familyName: String(f.familyName),
      subfamilyName: f.subfamilyName != null ? String(f.subfamilyName) : null,
      fullName: f.fullName != null ? String(f.fullName) : null,
      postscriptName: f.postscriptName != null ? String(f.postscriptName) : null
    })),
    sampleText: String(meta.sampleText ?? FONT_THUMB_SAMPLE_TEXT),
    sampleGlyphs: meta.sampleGlyphs.map((g) => ({
      char: g.char,
      codePoint: toFiniteNumber(g.codePoint),
      id: toFiniteNumber(g.id),
      advanceWidth: toFiniteNumber(g.advanceWidth),
      bbox: normalizeBBox(g.bbox)
    })),
    unicodeCoverage: meta.unicodeCoverage ?? null,
    variationAxes: meta.variationAxes?.length ? meta.variationAxes : null,
    thumbSampleVersion: meta.thumbSampleVersion != null ? toFiniteNumber(meta.thumbSampleVersion) : null
  }
}

function resolveGlyphId(glyph: { id: unknown }): number {
  const raw = glyph.id
  if (typeof raw === 'number') return raw
  return toFiniteNumber(raw)
}

function collectSampleGlyphs(face: Font, text: string): FontGlyphSummary[] {
  const out: FontGlyphSummary[] = []
  if (!text) return out

  try {
    const run = face.layout(text)
    const chars = [...text.replace(/\n/g, '')]
    let charIdx = 0
    for (let i = 0; i < run.glyphs.length; i++) {
      const glyph = run.glyphs[i]
      const char = chars[charIdx] ?? ''
      if (char === '\n') continue
      const codePoint = char.codePointAt(0)
      if (codePoint == null) continue
      out.push({
        char,
        codePoint,
        id: resolveGlyphId(glyph),
        advanceWidth: toFiniteNumber(glyph.advanceWidth ?? run.positions[i]?.xAdvance),
        bbox: normalizeBBox(glyph.bbox)
      })
      charIdx++
    }
    return out
  } catch {
    /* fall through */
  }

  for (const char of text.replace(/\n/g, '')) {
    const codePoint = char.codePointAt(0)
    if (codePoint == null) continue
    try {
      const glyph = face.glyphForCodePoint(codePoint)
      out.push({
        char,
        codePoint,
        id: resolveGlyphId(glyph),
        advanceWidth: toFiniteNumber(glyph.advanceWidth),
        bbox: normalizeBBox(glyph.bbox)
      })
    } catch {
      /* skip */
    }
  }
  return out
}

function formatFromExtension(extWithDot: string): string {
  return extWithDot.replace(/^\./, '').toLowerCase() || 'unknown'
}

/** Parse font file with fontkit (TTF/OTF/WOFF/WOFF2/TTC). */
export function parseFontFile(
  filePath: string,
  sampleText = FONT_THUMB_SAMPLE_TEXT,
  ttcIndex = 0,
  thumbSampleVersion = FONT_THUMB_SAMPLE_VERSION
): ParsedFontMetadata | null {
  try {
    const faces = listFontFacesFromFile(filePath)
    const opened = openFontFaceFromFile(filePath, ttcIndex)
    if (!opened) return null
    const { face, ttcIndex: idx, ttcFaceCount } = opened
    const sampleGlyphs = collectSampleGlyphs(face, sampleText)
    const coverage = analyzeUnicodeCoverage(face)
    const axes = parseVariationAxes(face)

    return sanitizeFontMetadata({
      familyName: face.familyName || 'Unknown',
      subfamilyName: face.subfamilyName ?? null,
      fullName: face.fullName ?? null,
      postscriptName: face.postscriptName ?? null,
      glyphCount: face.numGlyphs ?? 0,
      unitsPerEm: face.unitsPerEm ?? 1000,
      ascender: typeof face.ascent === 'number' ? face.ascent : null,
      descender: typeof face.descent === 'number' ? face.descent : null,
      lineGap: typeof face.lineGap === 'number' ? face.lineGap : null,
      format: formatFromExtension(extname(filePath)),
      ttcIndex: idx,
      ttcFaceCount,
      faces: faces.length > 1 ? faces : undefined,
      sampleText,
      sampleGlyphs,
      unicodeCoverage: coverage.totalCodePoints > 0 ? coverage : null,
      variationAxes: axes.length > 0 ? axes : null,
      thumbSampleVersion
    })
  } catch (error) {
    console.error(`[Font] Failed to parse ${filePath}:`, error)
    return null
  }
}
