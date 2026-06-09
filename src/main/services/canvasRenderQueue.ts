/**
 * Global serial queue for main-process @napi-rs/canvas (Skia) work.
 * Concurrent native renders (font thumb, text preview, full-page stitch) can crash Electron.
 */
let canvasRenderQueue: Promise<void> = Promise.resolve()

export function enqueueCanvasRender<T>(fn: () => T | Promise<T>): Promise<T> {
  const done = canvasRenderQueue.then(fn, fn)
  canvasRenderQueue = done.then(
    () => undefined,
    () => undefined
  )
  return done
}

export function awaitCanvasRenderIdle(): Promise<void> {
  return canvasRenderQueue
}
