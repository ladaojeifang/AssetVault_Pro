/** Serial queue for hidden Chromium thumb windows (SVG / text preview — no WebGL). */
let hiddenBrowserThumbQueue: Promise<void> = Promise.resolve()

export function enqueueHiddenBrowserThumb<T>(fn: () => Promise<T>): Promise<T> {
  const done = hiddenBrowserThumbQueue.then(fn, fn)
  hiddenBrowserThumbQueue = done.then(
    () => undefined,
    () => undefined
  )
  return done
}

export function awaitHiddenBrowserThumbIdle(): Promise<void> {
  return hiddenBrowserThumbQueue
}
