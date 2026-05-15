import { renderModelSnapshot } from '@renderer/utils/model3d/renderModelSnapshot'

type RenderPayload = {
  fileUrl: string
  ext: string
  size: number
  libraryPath?: string
  loadLikePreview?: boolean
}

declare global {
  interface Window {
    modelThumbHost: {
      onRenderRequest: (callback: (payload: RenderPayload) => void) => void
      sendResult: (result: { ok: boolean; dataUrl?: string; error?: string; ready?: boolean }) => void
    }
  }
}

const HIDDEN_RENDER_MS = 90_000

window.modelThumbHost.onRenderRequest(async (payload) => {
  try {
    const snapOpts = payload.loadLikePreview ? { loadLikePreview: true as const } : undefined
    const render = renderModelSnapshot(
      payload.fileUrl,
      payload.ext,
      payload.size,
      undefined,
      payload.libraryPath,
      snapOpts
    )
    const dataUrl = payload.loadLikePreview
      ? await render
      : await Promise.race([
          render,
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('render timeout')), HIDDEN_RENDER_MS)
          })
        ])
    window.modelThumbHost.sendResult({ ok: true, dataUrl })
  } catch (err) {
    window.modelThumbHost.sendResult({
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    })
  }
})

window.modelThumbHost.sendResult({ ok: true, ready: true })
