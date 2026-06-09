/** Text-like extensions that get a generated paper-style thumbnail. */
export const TEXT_PREVIEW_EXTENSIONS = new Set(['.json', '.md', '.txt'])

export interface TextPreviewRegenerateFailure {
  assetId: string
  filename: string
  reason: string
}

export interface TextPreviewRegenerateResult {
  scanned: number
  updated: number
  skipped: number
  errors: number
  failures: TextPreviewRegenerateFailure[]
}

export function isTextPreviewExtension(ext: string): boolean {
  const dot = ext.startsWith('.') ? ext : `.${ext}`
  return TEXT_PREVIEW_EXTENSIONS.has(dot.toLowerCase())
}
