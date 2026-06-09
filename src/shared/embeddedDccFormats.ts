/** 3D DCC formats with embedded preview thumbnails (no Babylon render). */
export const MODEL3D_EMBEDDED_THUMB_EXTENSIONS = new Set(['.c4d', '.max', '.blend'])

export type EmbeddedDccFormat = 'c4d' | 'max' | 'blend'

export interface EmbeddedDccRegenerateFailure {
  assetId: string
  filename: string
  reason: string
}

export interface EmbeddedDccRegenerateResult {
  scanned: number
  updated: number
  skipped: number
  errors: number
  failures: EmbeddedDccRegenerateFailure[]
}

export function parseEmbeddedDccFormat(ext: string): EmbeddedDccFormat | null {
  const e = ext.toLowerCase().replace(/^\./, '')
  if (e === 'c4d' || e === 'max' || e === 'blend') return e
  return null
}

export function isEmbeddedDccThumbExtension(ext: string): boolean {
  const dot = ext.startsWith('.') ? ext : `.${ext}`
  return MODEL3D_EMBEDDED_THUMB_EXTENSIONS.has(dot.toLowerCase())
}
