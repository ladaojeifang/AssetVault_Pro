import { awaitCanvasRenderIdle } from './canvasRenderQueue'

/**
 * Main-process Skia (@napi-rs/canvas) and hidden BrowserWindow thumbs (WebGL / SVG / text) must not overlap on Windows.
 * Dynamic imports avoid circular deps with thumbnail renderers.
 */
export async function awaitBeforeCanvasThumbnailWork(): Promise<void> {
  const [{ awaitModelThumbnailRenderIdle }, { awaitSvgThumbnailRenderIdle }] = await Promise.all([
    import('./modelThumbnailRenderer'),
    import('./svgThumbnailRenderer')
  ])
  await Promise.all([awaitModelThumbnailRenderIdle(), awaitSvgThumbnailRenderIdle()])
}

export async function awaitBeforeHiddenWindowThumbnailWork(): Promise<void> {
  await awaitCanvasRenderIdle()
}
