import type { EmbeddedDccFormat } from '@/shared/embeddedDccFormats'

export interface EmbeddedExtractResult {
  ok: boolean
  format?: EmbeddedDccFormat
  buffer?: Buffer
  mime?: 'image/jpeg' | 'image/bmp'
  width?: number
  height?: number
  error?: string
}
