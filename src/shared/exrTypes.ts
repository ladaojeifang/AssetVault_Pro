/** OpenEXR preview — shared types (main + renderer). */

import type { ExrAovDisplayMode } from './exrAovDisplay'

export type ExrChannelToggle = {
  r: boolean
  g: boolean
  b: boolean
  a: boolean
}

export type ExrLayerInfo = {
  /** Display name; empty source layer is shown as `RGBA`. */
  name: string
  /** Channel suffixes in this layer, e.g. R/G/B/A or X/Y/Z. */
  channels: string[]
  /** Layer can be decoded for preview (exrs). */
  previewable: boolean
  /** Preview tonemap / display mode for this AOV. */
  displayMode?: ExrAovDisplayMode
}

export type ExrFileMetadata = {
  width: number
  height: number
  layers: ExrLayerInfo[]
  /** Suggested initial layer (matches thumbnail default). */
  defaultLayerName?: string
  /** True when only dimensions/composite are known — layer list may be incomplete. */
  layerListIncomplete?: boolean
  /** False when R/G/B/A channel toggles are disabled (large EXR). */
  channelControlAvailable: boolean
  /** False when only RGBA composite preview is available (no per-AOV layer switching). */
  perLayerPreviewAvailable?: boolean
  /** From @napi-rs/image when decode probe succeeds. */
  format?: string
  colorType?: number
  probeSource?: 'header' | 'napi' | 'merged'
}

/** Persisted on import — OpenEXR header + image probe (not JPEG EXIF). */
export type ExrStoredMetadata = {
  width: number
  height: number
  format?: string
  colorType?: number
  layerCount: number
  layers: Array<{ name: string; channels: string[] }>
  probeSource: 'header' | 'napi' | 'merged'
}

export type ExrPreviewRenderRequest = {
  assetId: string
  layerName: string
  channels: ExrChannelToggle
  exposure: number
  maxEdge?: number
}

export type ExrPreviewRenderResult =
  | {
      ok: true
      /** JPEG served via assetvault-exr-preview:// (no base64 IPC). */
      previewUrl: string
      channelControlAvailable: boolean
      displayMode?: ExrAovDisplayMode
    }
  | {
      ok: false
      error: string
      failureReason?: import('./exrPreviewErrors').ExrPreviewFailureReason
    }

export const EXR_PREVIEW_DEFAULT_EXPOSURE = 1
export const EXR_PREVIEW_MAX_EDGE = 2048
export const EXR_PREVIEW_MIN_EXPOSURE = 0.1
export const EXR_PREVIEW_MAX_EXPOSURE = 8

/** Default layer name returned by metadata for the unnamed RGBA layer. */
export const EXR_DEFAULT_LAYER_NAME = 'RGBA'
