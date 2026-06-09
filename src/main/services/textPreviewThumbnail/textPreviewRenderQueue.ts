/** Serial queue — one ffmpeg text-preview at a time (avoids concurrent native/ffmpeg races). */
let textPreviewRenderQueue: Promise<void> = Promise.resolve()

export function enqueueTextPreviewRender<T>(fn: () => Promise<T>): Promise<T> {
  const done = textPreviewRenderQueue.then(fn, fn)
  textPreviewRenderQueue = done.then(
    () => undefined,
    () => undefined
  )
  return done
}
