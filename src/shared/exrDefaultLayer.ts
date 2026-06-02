import type { ExrLayerInfo } from './exrTypes'
import { EXR_DEFAULT_LAYER_NAME } from './exrTypes'

const DEFAULT_LAYER_PREFER = ['rgba', 'beauty', 'default', 'composite', 'combined'] as const

function layerHasRgb(channels: readonly string[]): boolean {
  const upper = new Set(channels.map((c) => c.toUpperCase()))
  return upper.has('R') && upper.has('G') && upper.has('B')
}

/** Pick default preview/thumbnail layer from metadata layer list (name-only, no pixel read). */
export function pickExrDefaultLayerNameFromLayers(layers: readonly ExrLayerInfo[]): string {
  if (layers.length === 0) return EXR_DEFAULT_LAYER_NAME

  for (const pref of DEFAULT_LAYER_PREFER) {
    const hit = layers.find((l) => l.name.toLowerCase() === pref)
    if (hit) return hit.name
  }

  const hdrRgb = layers.find((l) => l.displayMode === 'hdr' && layerHasRgb(l.channels))
  if (hdrRgb) return hdrRgb.name

  const anyRgb = layers.find((l) => layerHasRgb(l.channels))
  if (anyRgb) return anyRgb.name

  return layers[0]!.name
}
