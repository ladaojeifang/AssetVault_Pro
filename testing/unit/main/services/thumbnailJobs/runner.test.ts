import { describe, expect, it } from 'vitest'
import {
  embeddedDccThumbnailJob,
  model3dThumbnailJob,
  resolveAsyncThumbnailJob,
  textPreviewThumbnailJob
} from '@main/services/thumbnailJobs/definitions'

describe('thumbnailJobs definitions', () => {
  it('resolves the correct job per asset type', () => {
    expect(resolveAsyncThumbnailJob('3d', 'glb')?.id).toBe('model3d')
    expect(resolveAsyncThumbnailJob('3d', 'max')?.id).toBe('embedded-dcc')
    expect(resolveAsyncThumbnailJob('code', 'json')?.id).toBe('text-preview')
    expect(resolveAsyncThumbnailJob('document', 'md')?.id).toBe('text-preview')
    expect(resolveAsyncThumbnailJob('3d', 'usd')).toBeNull()
  })

  it('keeps distinct retry policies per job', () => {
    expect(model3dThumbnailJob.maxAttempts).toBe(3)
    expect(embeddedDccThumbnailJob.maxAttempts).toBe(3)
    expect(textPreviewThumbnailJob.maxAttempts).toBe(2)
  })
})
