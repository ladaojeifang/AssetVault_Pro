import { describe, expect, it } from 'vitest'
import {
  computeOutputScale,
  computeStitchedHeight
} from './fullPageStitchService'

describe('computeStitchedHeight', () => {
  it('sums strip heights minus overlap', () => {
    const { heightPx } = computeStitchedHeight([1000, 2000], 80)
    expect(heightPx).toBe(2920)
  })

  it('clamps overlap when too large', () => {
    const { heightPx, warnings } = computeStitchedHeight([500, 500], 600)
    expect(heightPx).toBeLessThan(1000)
    expect(warnings).toContain('overlap_clamped')
  })
})

describe('computeOutputScale', () => {
  it('scales down when exceeding pixel budget', () => {
    const { scale, scaledDown } = computeOutputScale(4000, 40000, 120_000_000, 32768)
    expect(scaledDown).toBe(true)
    expect(scale).toBeLessThan(1)
  })

  it('keeps scale 1 for small output', () => {
    const { scale, scaledDown } = computeOutputScale(800, 1000, 120_000_000, 32768)
    expect(scaledDown).toBe(false)
    expect(scale).toBe(1)
  })
})
