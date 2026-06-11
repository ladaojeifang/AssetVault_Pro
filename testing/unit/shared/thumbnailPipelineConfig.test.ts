import { describe, expect, it } from 'vitest'
import {
  THUMBNAIL_PIPELINE,
  clampThumbnailMaxEdge,
  clampThumbnailQuality,
  gridThumbnailRetryDelayMs
} from '@/shared/thumbnailPipelineConfig'

describe('thumbnailPipelineConfig', () => {
  it('clamps max edge to pipeline bounds', () => {
    expect(clampThumbnailMaxEdge(64)).toBe(128)
    expect(clampThumbnailMaxEdge(256)).toBe(256)
    expect(clampThumbnailMaxEdge(900)).toBe(512)
  })

  it('computes grid retry backoff', () => {
    expect(gridThumbnailRetryDelayMs(0)).toBe(1500)
    expect(gridThumbnailRetryDelayMs(3)).toBe(4500)
    expect(gridThumbnailRetryDelayMs(99)).toBe(THUMBNAIL_PIPELINE.grid.ipcRetryCapMs)
  })

  it('clamps quality', () => {
    expect(clampThumbnailQuality(5)).toBe(10)
    expect(clampThumbnailQuality(200)).toBe(100)
  })
})
