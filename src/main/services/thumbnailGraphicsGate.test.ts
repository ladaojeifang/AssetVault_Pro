import { describe, expect, it, vi } from 'vitest'

const mockCanvasQueue = {
  awaitCanvasRenderIdle: vi.fn().mockResolvedValue(undefined)
}
const mockModelRenderer = {
  awaitModelThumbnailRenderIdle: vi.fn().mockResolvedValue(undefined)
}
const mockSvgRenderer = {
  awaitSvgThumbnailRenderIdle: vi.fn().mockResolvedValue(undefined)
}

vi.mock('./canvasRenderQueue', () => mockCanvasQueue)
vi.mock('./modelThumbnailRenderer', () => mockModelRenderer)
vi.mock('./svgThumbnailRenderer', () => mockSvgRenderer)

import { awaitBeforeCanvasThumbnailWork, awaitBeforeHiddenWindowThumbnailWork } from './thumbnailGraphicsGate'
import { awaitCanvasRenderIdle } from './canvasRenderQueue'
import { awaitModelThumbnailRenderIdle } from './modelThumbnailRenderer'
import { awaitSvgThumbnailRenderIdle } from './svgThumbnailRenderer'

describe('thumbnailGraphicsGate', () => {
  it('waits for hidden-window queues before canvas work', async () => {
    await awaitBeforeCanvasThumbnailWork()
    expect(awaitModelThumbnailRenderIdle).toHaveBeenCalled()
    expect(awaitSvgThumbnailRenderIdle).toHaveBeenCalled()
  })

  it('waits for canvas queue before hidden-window work', async () => {
    await awaitBeforeHiddenWindowThumbnailWork()
    expect(awaitCanvasRenderIdle).toHaveBeenCalled()
  })
})
