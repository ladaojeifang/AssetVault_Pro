import { describe, expect, it } from 'vitest'
import { classifyStderr, stderrTailLines } from './ytdlpStderr'

describe('stderrTailLines', () => {
  it('returns last 15 non-empty lines', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `row-${String(i + 1).padStart(2, '0')}`)
    const tail = stderrTailLines(lines.join('\n'), 15)
    expect(tail.split('\n')).toHaveLength(15)
    expect(tail).toContain('row-20')
    expect(tail).not.toContain('row-01')
  })
})

describe('classifyStderr', () => {
  it('detects auth required', () => {
    expect(classifyStderr('ERROR: Sign in to confirm your age')).toBe('YTDLP_AUTH_REQUIRED')
  })

  it('detects format unavailable', () => {
    expect(
      classifyStderr('ERROR: [youtube] x: Requested format is not available')
    ).toBe('YTDLP_FORMAT_UNAVAILABLE')
  })
})
