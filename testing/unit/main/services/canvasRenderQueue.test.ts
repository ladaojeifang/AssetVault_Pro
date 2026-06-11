import { describe, expect, it } from 'vitest'
import { enqueueCanvasRender } from '@main/services/canvasRenderQueue'

describe('canvasRenderQueue', () => {
  it('runs jobs serially', async () => {
    const order: number[] = []
    const delay = (ms: number, id: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          order.push(id)
          resolve()
        }, ms)
      })

    const p1 = enqueueCanvasRender(() => delay(30, 1))
    const p2 = enqueueCanvasRender(() => delay(10, 2))
    const p3 = enqueueCanvasRender(() => delay(5, 3))

    await Promise.all([p1, p2, p3])
    expect(order).toEqual([1, 2, 3])
  })
})
