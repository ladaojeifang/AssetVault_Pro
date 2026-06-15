import { describe, expect, it } from 'vitest'
import {
  embeddedDccThumbnailJob,
  model3dThumbnailJob,
  resolveAsyncThumbnailJob,
  textPreviewThumbnailJob
} from '@main/services/thumbnailJobs/definitions'

describe('thumbnailJobs definitions', () => {
  it('resolves the correct job per extension', () => {
    expect(resolveAsyncThumbnailJob('glb')?.id).toBe('model3d')
    expect(resolveAsyncThumbnailJob('max')?.id).toBe('embedded-dcc')
    expect(resolveAsyncThumbnailJob('json')?.id).toBe('text-preview')
    expect(resolveAsyncThumbnailJob('md')?.id).toBe('text-preview')
    expect(resolveAsyncThumbnailJob('usd')).toBeNull()
  })

  it('matches assets by extension regardless of stored fileType', () => {
    expect(model3dThumbnailJob.matchesAsset('glb')).toBe(true)
    expect(model3dThumbnailJob.matchesAsset('usd')).toBe(false)
    expect(embeddedDccThumbnailJob.matchesAsset('blend')).toBe(true)
    expect(textPreviewThumbnailJob.matchesAsset('txt')).toBe(true)
    expect(textPreviewThumbnailJob.matchesAsset('pdf')).toBe(false)
  })

  it('keeps distinct retry policies per job', () => {
    expect(model3dThumbnailJob.maxAttempts).toBe(3)
    expect(embeddedDccThumbnailJob.maxAttempts).toBe(3)
    expect(textPreviewThumbnailJob.maxAttempts).toBe(2)
  })
})
