import type { WebContents } from 'electron'

export type HiddenThumbIpcPayload = {
  requestId?: number
  ok: boolean
  dataUrl?: string
  error?: string
  ready?: boolean
}

type PendingRender = {
  resolve: (buf: Buffer | null) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Request-id keyed pending map + generation-guarded ready signal for hidden thumb BrowserWindows.
 * Avoids single-slot `pending` / `readyResolve` races when the window reloads or renders overlap.
 */
export class HiddenOffscreenThumbHost {
  private nextRequestId = 1
  private pending = new Map<number, PendingRender>()
  private initGeneration = 0
  private readyWaiter: { generation: number; resolve: () => void; reject: (e: Error) => void } | null = null

  beginWindowInit(): number {
    this.initGeneration++
    this.cancelAllPending('hidden window reinitialized')
    return this.initGeneration
  }

  waitForReady(generation: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.readyWaiter?.generation === generation) {
          this.readyWaiter = null
        }
        reject(new Error('hidden thumb window init timeout'))
      }, timeoutMs)

      this.readyWaiter = {
        generation,
        resolve: () => {
          clearTimeout(timer)
          if (this.readyWaiter?.generation === generation) this.readyWaiter = null
          resolve()
        },
        reject: (e) => {
          clearTimeout(timer)
          if (this.readyWaiter?.generation === generation) this.readyWaiter = null
          reject(e)
        }
      }
    })
  }

  handleIpcResult(
    sender: WebContents,
    expectedSender: WebContents | null | undefined,
    payload: HiddenThumbIpcPayload,
    decodeDataUrl: (dataUrl: string) => Buffer | null
  ): void {
    if (payload.ready) {
      if (this.readyWaiter) this.readyWaiter.resolve()
      return
    }
    if (!expectedSender || sender !== expectedSender) return
    const requestId = payload.requestId
    if (requestId == null) return
    const entry = this.pending.get(requestId)
    if (!entry) return
    this.pending.delete(requestId)
    clearTimeout(entry.timer)
    if (payload.ok && payload.dataUrl) {
      entry.resolve(decodeDataUrl(payload.dataUrl))
    } else {
      entry.resolve(null)
    }
  }

  requestRender<T extends object>(
    send: (payload: T & { requestId: number }) => void,
    payload: T,
    timeoutMs: number,
    onTimeout?: () => void
  ): Promise<Buffer | null> {
    const requestId = this.nextRequestId++
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(requestId)) return
        this.pending.delete(requestId)
        onTimeout?.()
        resolve(null)
      }, timeoutMs)
      this.pending.set(requestId, { resolve, timer })
      send({ ...payload, requestId })
    })
  }

  cancelAllPending(_reason?: string): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer)
      entry.resolve(null)
    }
    this.pending.clear()
  }

  destroy(): void {
    this.cancelAllPending()
    if (this.readyWaiter) {
      this.readyWaiter.reject(new Error('hidden thumb window destroyed'))
      this.readyWaiter = null
    }
  }
}
