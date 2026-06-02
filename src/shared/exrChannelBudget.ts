/** EXR preview decode / UI budget helpers (shared main + renderer). */

export const EXRS_PREVIEW_PIXEL_BUDGET = 4096 * 4096

/** Above this pixel count, per-layer exrs preview is disabled (RGBA composite only). */
export const EXRS_PER_LAYER_PIXEL_BUDGET = EXRS_PREVIEW_PIXEL_BUDGET * 4

export const EXRS_CHANNEL_TOGGLE_FILE_BUDGET = 256 * 1024 * 1024
export const EXRS_PER_LAYER_FILE_BUDGET = 512 * 1024 * 1024

export function estimateExrsPerLayerPreviewAvailable(
  width: number,
  height: number,
  fileSizeBytes?: number
): boolean {
  if (width <= 0 || height <= 0) return false
  if (width * height > EXRS_PER_LAYER_PIXEL_BUDGET) return false
  if (typeof fileSizeBytes === 'number' && fileSizeBytes > EXRS_PER_LAYER_FILE_BUDGET) return false
  return true
}

/** Whether R/G/B/A channel toggles are allowed in the EXR preview UI. */
export function estimateExrsChannelToggleAvailable(
  width: number,
  height: number,
  fileSizeBytes?: number
): boolean {
  if (width <= 0 || height <= 0) return false
  if (!estimateExrsPerLayerPreviewAvailable(width, height, fileSizeBytes)) return false
  if (width * height > EXRS_PREVIEW_PIXEL_BUDGET) return false
  if (typeof fileSizeBytes === 'number' && fileSizeBytes > EXRS_CHANNEL_TOGGLE_FILE_BUDGET) {
    return false
  }
  return true
}

/** @deprecated Use estimateExrsChannelToggleAvailable */
export function estimateExrsChannelControlAvailable(
  width: number,
  height: number,
  fileSizeBytes?: number
): boolean {
  return estimateExrsChannelToggleAvailable(width, height, fileSizeBytes)
}
