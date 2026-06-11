import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  awaitCanvasRenderIdle: vi.fn().mockResolvedValue(undefined),
  awaitModelThumbnailRenderIdle: vi.fn().mockResolvedValue(undefined),
  awaitSvgThumbnailRenderIdle: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@main/services/canvasRenderQueue', () => ({
  awaitCanvasRenderIdle: mocks.awaitCanvasRenderIdle
}))
vi.mock('@main/services/modelThumbnailRenderer', () => ({
  awaitModelThumbnailRenderIdle: mocks.awaitModelThumbnailRenderIdle
}))
vi.mock('@main/services/svgThumbnailRenderer', () => ({
  awaitSvgThumbnailRenderIdle: mocks.awaitSvgThumbnailRenderIdle
}))

import { awaitBeforeCanvasThumbnailWork, awaitBeforeHiddenWindowThumbnailWork } from '@main/services/thumbnailGraphicsGate'

describe('thumbnailGraphicsGate', () => {
  it('waits for hidden-window queues before canvas work', async () => {
    await awaitBeforeCanvasThumbnailWork()
    expect(mocks.awaitModelThumbnailRenderIdle).toHaveBeenCalled()
    expect(mocks.awaitSvgThumbnailRenderIdle).toHaveBeenCalled()
  })

  it('waits for canvas queue before hidden-window work', async () => {
    await awaitBeforeHiddenWindowThumbnailWork()
    expect(mocks.awaitCanvasRenderIdle).toHaveBeenCalled()
  })
})
