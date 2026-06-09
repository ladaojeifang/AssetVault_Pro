import { describe, expect, it } from 'vitest'
import { HiddenOffscreenThumbHost } from './hiddenOffscreenThumbHost'

function fakeSender() {
  return {} as import('electron').WebContents
}

describe('HiddenOffscreenThumbHost', () => {
  it('resolves render by requestId without cross-talk', async () => {
    const host = new HiddenOffscreenThumbHost()
    const sender = fakeSender()
    const decode = (dataUrl: string) => Buffer.from(dataUrl.split(',')[1] ?? '', 'base64')

    const p1 = host.requestRender(() => {}, { fileUrl: 'a' }, 5000)
    const p2 = host.requestRender(() => {}, { fileUrl: 'b' }, 5000)

    host.handleIpcResult(sender, sender, { requestId: 2, ok: true, dataUrl: 'data:image/png;base64,YmI=' }, decode)
    host.handleIpcResult(sender, sender, { requestId: 1, ok: true, dataUrl: 'data:image/png;base64,YWE=' }, decode)

    await expect(p1).resolves.toEqual(Buffer.from('aa', 'utf8'))
    await expect(p2).resolves.toEqual(Buffer.from('bb', 'utf8'))
  })

  it('cancels pending renders on window reinit', async () => {
    const host = new HiddenOffscreenThumbHost()
    const pending = host.requestRender(() => {}, { fileUrl: 'x' }, 60_000)
    host.beginWindowInit()
    await expect(pending).resolves.toBeNull()
  })

  it('ignores stale ready signals after reinit generation', async () => {
    const host = new HiddenOffscreenThumbHost()
    const gen = host.beginWindowInit()
    const ready = host.waitForReady(gen, 50)
    host.beginWindowInit()
    await expect(ready).rejects.toThrow(/timeout/)
  })
})
