import { BrowserWindow, ipcMain, app } from 'electron'
import { readFileSync, statSync } from 'fs'
import { join } from 'path'
import { THUMBNAIL_MAX_EDGE } from '../utils/thumbnailSizing'
import { isSvgFilePath, MAX_SVG_RASTER_BYTES } from '@/shared/svgFormats'
import {
  assetIdFromItemPackPath,
  isSvgFileOverRasterLimit,
  isSvgRasterSkipped,
  markSvgRasterSkipped
} from './svgRasterSkip'

/** @deprecated use MAX_SVG_RASTER_BYTES from @/shared/svgFormats */
export const MAX_SVG_BYTES = MAX_SVG_RASTER_BYTES

const loggedOversizedPaths = new Set<string>()
const RENDER_TIMEOUT_MS = 5000
const WINDOW_INIT_MS = 30_000
const THUMB_PIXEL_SIZE = THUMBNAIL_MAX_EDGE

let thumbWindow: BrowserWindow | null = null
let windowReady: Promise<void> | null = null
let readyResolve: (() => void) | null = null
let thumbRenderQueue: Promise<void> = Promise.resolve()

let pending: {
  resolve: (buf: Buffer | null) => void
  timer: ReturnType<typeof setTimeout>
} | null = null

function isDevRenderer(): boolean {
  return !!process.env.ELECTRON_RENDERER_URL
}

function thumbPageUrl(): string {
  if (isDevRenderer()) {
    return `${process.env.ELECTRON_RENDERER_URL}/svg-thumbnail/index.html`
  }
  return join(__dirname, '../renderer/svg-thumbnail/index.html')
}

function thumbPreloadPath(): string {
  return join(__dirname, '../preload/svgThumbnail.js')
}

function waitForReadySignal(): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('SVG thumbnail window init timeout')), WINDOW_INIT_MS)
    readyResolve = () => {
      clearTimeout(t)
      readyResolve = null
      resolve()
    }
  })
}

async function ensureThumbnailWindow(): Promise<BrowserWindow> {
  if (thumbWindow && !thumbWindow.isDestroyed()) {
    return thumbWindow
  }

  windowReady = waitForReadySignal()

  thumbWindow = new BrowserWindow({
    show: false,
    width: THUMB_PIXEL_SIZE,
    height: THUMB_PIXEL_SIZE,
    webPreferences: {
      preload: thumbPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webgl: false
    }
  })

  thumbWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[SvgThumbnail] did-fail-load', code, desc)
  })

  const url = thumbPageUrl()
  if (isDevRenderer()) {
    await thumbWindow.loadURL(url)
  } else {
    await thumbWindow.loadFile(url)
  }

  await windowReady
  return thumbWindow
}

function setupIpcOnce(): void {
  if ((setupIpcOnce as { done?: boolean }).done) return
  ;(setupIpcOnce as { done?: boolean }).done = true

  ipcMain.on(
    'svg-thumbnail:result',
    (event, payload: { ok: boolean; dataUrl?: string; error?: string; ready?: boolean }) => {
      if (payload.ready) {
        readyResolve?.()
        return
      }

      const win = thumbWindow
      if (!win || event.sender !== win.webContents) return
      if (!pending) return

      const { resolve, timer } = pending
      pending = null
      clearTimeout(timer)

      if (payload.ok && payload.dataUrl?.startsWith('data:image/webp')) {
        const b64 = payload.dataUrl.split(',')[1]
        resolve(b64 ? Buffer.from(b64, 'base64') : null)
      } else {
        if (payload.error) {
          console.warn('[SvgThumbnail] skipped:', payload.error)
        }
        resolve(null)
      }
    }
  )
}

export function destroySvgThumbnailWindow(): void {
  if (thumbWindow && !thumbWindow.isDestroyed()) {
    thumbWindow.destroy()
  }
  thumbWindow = null
  windowReady = null
  readyResolve = null
  pending = null
}

export function initSvgThumbnailRenderer(): void {
  setupIpcOnce()
  app.on('before-quit', () => {
    destroySvgThumbnailWindow()
  })
}

export function warmHiddenSvgThumbnailWindow(): void {
  setupIpcOnce()
  void ensureThumbnailWindow().catch((e) =>
    console.warn('[SvgThumbnail] hidden window warm-up failed:', e)
  )
}

function logOversizedOnce(absFilePath: string, sizeBytes: number): void {
  if (loggedOversizedPaths.has(absFilePath)) return
  loggedOversizedPaths.add(absFilePath)
  const mb = (sizeBytes / (1024 * 1024)).toFixed(1)
  const maxMb = (MAX_SVG_RASTER_BYTES / (1024 * 1024)).toFixed(0)
  console.warn(
    `[SvgThumbnail] skipped oversized SVG (${mb} MB > ${maxMb} MB limit):`,
    absFilePath
  )
}

function svgFileToDataUrl(absFilePath: string): string | null {
  const assetId = assetIdFromItemPackPath(absFilePath)
  if (assetId && isSvgRasterSkipped(assetId)) {
    return null
  }

  try {
    const st = statSync(absFilePath)
    if (!st.isFile()) {
      return null
    }
    if (st.size > MAX_SVG_RASTER_BYTES) {
      if (assetId) markSvgRasterSkipped(assetId, `oversized:${st.size}`)
      logOversizedOnce(absFilePath, st.size)
      return null
    }
    const buf = readFileSync(absFilePath)
    return `data:image/svg+xml;base64,${buf.toString('base64')}`
  } catch (e) {
    if (!loggedOversizedPaths.has(absFilePath)) {
      loggedOversizedPaths.add(absFilePath)
      console.warn('[SvgThumbnail] read failed:', absFilePath, e)
    }
    return null
  }
}

async function renderViaHiddenWindow(
  dataUrl: string,
  options: { size?: number; quality?: number }
): Promise<Buffer | null> {
  let win: BrowserWindow
  try {
    win = await ensureThumbnailWindow()
  } catch (e) {
    console.warn('[SvgThumbnail] hidden window init failed:', e)
    return null
  }

  return new Promise<Buffer | null>((resolve) => {
    const timer = setTimeout(() => {
      if (!pending) return
      const p = pending
      pending = null
      clearTimeout(p.timer)
      console.warn('[SvgThumbnail] render timeout')
      p.resolve(null)
    }, RENDER_TIMEOUT_MS)

    pending = { resolve, timer }

    win.webContents.send('svg-thumbnail:render', {
      dataUrl,
      size: options.size ?? THUMB_PIXEL_SIZE,
      quality: options.quality ?? 80
    })
  })
}

/**
 * Rasterize SVG via sandboxed hidden window (<img> + OffscreenCanvas → WebP).
 */
export async function renderSvgToWebpBuffer(
  absFilePath: string,
  options?: { size?: number; quality?: number }
): Promise<Buffer | null> {
  if (!isSvgFilePath(absFilePath)) return null

  const assetId = assetIdFromItemPackPath(absFilePath)
  if (assetId && isSvgRasterSkipped(assetId)) {
    return null
  }
  if (isSvgFileOverRasterLimit(absFilePath)) {
    if (assetId) {
      try {
        const st = statSync(absFilePath)
        markSvgRasterSkipped(assetId, `oversized:${st.size}`)
        logOversizedOnce(absFilePath, st.size)
      } catch {
        markSvgRasterSkipped(assetId, 'oversized')
      }
    }
    return null
  }

  setupIpcOnce()

  const run = async (): Promise<Buffer | null> => {
    const dataUrl = svgFileToDataUrl(absFilePath)
    if (!dataUrl) return null
    return renderViaHiddenWindow(dataUrl, options)
  }

  const done = thumbRenderQueue.then(run, run)
  thumbRenderQueue = done.then(
    () => undefined,
    () => undefined
  )
  return done
}
