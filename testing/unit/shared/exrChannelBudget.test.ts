import { describe, expect, it } from 'vitest'
import {
  estimateExrsChannelControlAvailable,
  estimateExrsChannelToggleAvailable,
  estimateExrsPerLayerPreviewAvailable,
  EXRS_CHANNEL_TOGGLE_FILE_BUDGET,
  EXRS_PER_LAYER_FILE_BUDGET,
  EXRS_PREVIEW_PIXEL_BUDGET
} from '@/shared/exrChannelBudget'

describe('estimateExrsPerLayerPreviewAvailable', () => {
  it('allows per-layer preview for normal production frames', () => {
    expect(estimateExrsPerLayerPreviewAvailable(1920, 1080)).toBe(true)
    expect(estimateExrsPerLayerPreviewAvailable(4096, 4096)).toBe(true)
  })

  it('denies per-layer preview for extreme resolution or huge files', () => {
    const side = Math.floor(Math.sqrt(EXRS_PREVIEW_PIXEL_BUDGET * 4)) + 1
    expect(estimateExrsPerLayerPreviewAvailable(side, side)).toBe(false)
    expect(
      estimateExrsPerLayerPreviewAvailable(4096, 4096, EXRS_PER_LAYER_FILE_BUDGET + 1)
    ).toBe(false)
  })

  it('rejects invalid dimensions', () => {
    expect(estimateExrsPerLayerPreviewAvailable(0, 1080)).toBe(false)
  })
})

describe('estimateExrsChannelToggleAvailable', () => {
  it('allows channel toggles within pixel and file budgets', () => {
    expect(estimateExrsChannelToggleAvailable(1920, 1080)).toBe(true)
    expect(estimateExrsChannelToggleAvailable(4096, 4096)).toBe(true)
  })

  it('denies toggles when pixels exceed budget', () => {
    const side = Math.floor(Math.sqrt(EXRS_PREVIEW_PIXEL_BUDGET)) + 1
    expect(estimateExrsChannelToggleAvailable(side, side)).toBe(false)
    expect(estimateExrsPerLayerPreviewAvailable(side, side)).toBe(true)
  })

  it('denies toggles when file exceeds 256MB even if resolution is modest', () => {
    expect(estimateExrsChannelToggleAvailable(1920, 1080, EXRS_CHANNEL_TOGGLE_FILE_BUDGET + 1)).toBe(
      false
    )
    expect(
      estimateExrsPerLayerPreviewAvailable(1920, 1080, EXRS_CHANNEL_TOGGLE_FILE_BUDGET + 1)
    ).toBe(true)
  })

  it('rejects invalid dimensions', () => {
    expect(estimateExrsChannelToggleAvailable(1920, -1)).toBe(false)
  })
})

describe('estimateExrsChannelControlAvailable (alias)', () => {
  it('matches channel toggle helper', () => {
    expect(estimateExrsChannelControlAvailable(1920, 1080)).toBe(
      estimateExrsChannelToggleAvailable(1920, 1080)
    )
  })
})
