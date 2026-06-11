import { describe, expect, it } from 'vitest'
import type { ExrLayerInfo } from '@/shared/exrTypes'
import { EXR_DEFAULT_LAYER_NAME } from '@/shared/exrTypes'
import { pickExrDefaultLayerNameFromLayers } from '@/shared/exrDefaultLayer'

function layer(name: string, channels: string[], displayMode: ExrLayerInfo['displayMode'] = 'hdr'): ExrLayerInfo {
  return { name, channels, previewable: true, displayMode }
}

describe('pickExrDefaultLayerNameFromLayers', () => {
  it('prefers RGBA and beauty names', () => {
    const layers = [
      layer('albedo', ['R', 'G', 'B']),
      layer('RGBA', ['R', 'G', 'B', 'A']),
      layer('N', ['R', 'G', 'B'], 'vector')
    ]
    expect(pickExrDefaultLayerNameFromLayers(layers)).toBe('RGBA')

    const aovs = [layer('N', ['R', 'G', 'B'], 'vector'), layer('beauty', ['R', 'G', 'B'])]
    expect(pickExrDefaultLayerNameFromLayers(aovs)).toBe('beauty')
  })

  it('falls back to first HDR RGB layer', () => {
    const layers = [
      layer('N', ['R', 'G', 'B'], 'vector'),
      layer('albedo', ['R', 'G', 'B']),
      layer('Z', ['R', 'G', 'B'], 'data')
    ]
    expect(pickExrDefaultLayerNameFromLayers(layers)).toBe('albedo')
  })

  it('returns RGBA when list is empty', () => {
    expect(pickExrDefaultLayerNameFromLayers([])).toBe(EXR_DEFAULT_LAYER_NAME)
  })
})
