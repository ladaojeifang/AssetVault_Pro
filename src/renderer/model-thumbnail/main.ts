import { renderModelSnapshot } from '@renderer/utils/model3d/renderModelSnapshot'

type RenderPayload = {
  fileUrl: string
  ext: string
  size: number
  libraryPath?: string
}

declare global {
  interface Window {
    modelThumbHost: {
      onRenderRequest: (callback: (payload: RenderPayload) => void) => void
      sendResult: (result: { ok: boolean; dataUrl?: string; error?: string; ready?: boolean }) => void
    }
  }
}

const HIDDEN_RENDER_MS = 120_000

window.modelThumbHost.onRenderRequest(async (payload) => {
  try {
    const dataUrl = await Promise.race([
      renderModelSnapshot(
        payload.fileUrl,
        payload.ext,
        payload.size,
        undefined,
        payload.libraryPath
      ),
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
