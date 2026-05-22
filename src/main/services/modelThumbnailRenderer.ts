import { BrowserWindow, ipcMain, app } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { parseModel3dFormat } from '@/shared/model3dFormats'
import { getMainBrowserWindow } from './mainWindowRef'

/** Hidden-window fallback cap (main-window path uses preview load, no short race). */
const HIDDEN_RENDER_TIMEOUT_MS = 120_000
/** First load pulls ~15MB Babylon/FBX bundle — 30s was too short in dev. */
const HIDDEN_WINDOW_INIT_MS = 120_000
const MAIN_RENDER_TIMEOUT_MS = 120_000
const THUMB_PIXEL_SIZE = 512

let thumbWindow: BrowserWindow | null = null
let windowReady: Promise<void> | null = null
let readyResolve: (() => void) | null = null

let thumbRenderQueue: Promise<void> = Promise.resolve()

function isDevRenderer(): boolean {
  return !!process.env.ELECTRON_RENDERER_URL
}

function thumbPageUrl(): string {
  if (isDevRenderer()) {
    return `${process.env.ELECTRON_RENDERER_URL}/model-thumbnail/index.html`
  }
  return join(__dirname, '../renderer/model-thumbnail/index.html')
}

function thumbPreloadPath(): string {
  return join(__dirname, '../preload/modelThumbnail.js')
}

function waitForReadySignal(): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error('Model thumbnail window init timeout')),
      HIDDEN_WINDOW_INIT_MS
    )
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
      webgl: true
    }
  })

  thumbWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[ModelThumbnail] did-fail-load', code, desc)
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
    'model-thumbnail:result',
    (
      event,
      payload: { ok: boolean; dataUrl?: string; error?: string; ready?: boolean }
    ) => {
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

      if (payload.ok && payload.dataUrl && payload.dataUrl.startsWith('data:image')) {
        const b64 = payload.dataUrl.split(',')[1]
        if (b64) resolve(Buffer.from(b64, 'base64'))
        else resolve(null)
      } else {
        if (payload.error) {
          console.warn('[ModelThumbnail] skipped:', payload.error)
        }
        resolve(null)
      }
    }
  )
}

let pending: {
  resolve: (buf: Buffer | null) => void
  timer: ReturnType<typeof setTimeout>
} | null = null

export function initModelThumbnailRenderer(): void {
  setupIpcOnce()
  app.on('before-quit', () => {
    if (thumbWindow && !thumbWindow.isDestroyed()) {
      thumbWindow.destroy()
    }
    thumbWindow = null
  })
}

/** Pre-load hidden offscreen page (large Babylon bundle) so first thumb is faster. */
export function warmHiddenThumbnailWindow(): void {
  setupIpcOnce()
  void ensureThumbnailWindow().catch((e) =>
    console.warn('[ModelThumbnail] hidden window warm-up failed:', e)
  )
}

async function waitForSnapshotBridge(win: BrowserWindow, maxMs = 60_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (win.isDestroyed()) throw new Error('main window destroyed')
    if (win.webContents.isLoading()) {
      await new Promise((r) => setTimeout(r, 150))
      continue
    }
    const ready = await win.webContents.executeJavaScript(
      'typeof window.__assetVaultRenderModelSnapshot === "function"'
    )
    if (ready) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('snapshot bridge not ready')
}

function dataUrlToBuffer(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return null
  const b64 = dataUrl.split(',')[1]
  return b64 ? Buffer.from(b64, 'base64') : null
}

type SnapshotJsResult = string | { __err: string }

/** Prefer main UI window (same stack as preview); fall back to hidden offscreen window. */
async function renderViaMainWindow(absFilePath: string, ext: string): Promise<Buffer | null> {
  const win = getMainBrowserWindow()
  if (!win) {
    console.warn('[ModelThumbnail] main window unavailable')
    return null
  }

  try {
    await waitForSnapshotBridge(win)
    const extClean = ext.replace(/^\./, '').toLowerCase()
    const js = `(async () => {
      try {
        return await window.__assetVaultRenderModelSnapshot(${JSON.stringify(absFilePath)}, ${JSON.stringify(extClean)}, ${THUMB_PIXEL_SIZE});
      } catch (e) {
        return { __err: e instanceof Error ? e.message : String(e) };
      }
    })()`
    const result = (await Promise.race([
      win.webContents.executeJavaScript(js, true),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('main window render timeout')), MAIN_RENDER_TIMEOUT_MS)
      })
    ])) as SnapshotJsResult

    if (result && typeof result === 'object' && '__err' in result) {
      console.warn('[ModelThumbnail] renderer snapshot error:', result.__err, absFilePath)
      return null
    }

    const buf = dataUrlToBuffer(result)
    if (buf) {
      console.log('[ModelThumbnail] captured via main window:', absFilePath)
      return buf
    }
    console.warn('[ModelThumbnail] main window returned empty snapshot:', absFilePath)
    return null
  } catch (e) {
    console.warn('[ModelThumbnail] main window path failed:', e)
    return null
  }
}

async function renderViaHiddenWindow(absFilePath: string, ext: string): Promise<Buffer | null> {
  let win: BrowserWindow
  try {
    win = await ensureThumbnailWindow()
  } catch (e) {
    console.warn('[ModelThumbnail] hidden window init failed:', e)
    return null
  }
  const fileUrl = pathToFileURL(absFilePath).href

  return new Promise<Buffer | null>((resolve) => {
    const timer = setTimeout(() => {
      if (!pending) return
      const p = pending
      pending = null
      clearTimeout(p.timer)
      console.warn('[ModelThumbnail] skipped (hidden timeout):', absFilePath)
      p.resolve(null)
    }, HIDDEN_RENDER_TIMEOUT_MS)

    pending = { resolve, timer }

    win.webContents.send('model-thumbnail:render', {
      fileUrl,
      libraryPath: absFilePath,
      ext: ext.replace(/^\./, '').toLowerCase(),
      size: THUMB_PIXEL_SIZE
    })
  })
}

export async function renderModelToPngBuffer(
  absFilePath: string,
  ext: string
): Promise<Buffer | null> {
  const format = parseModel3dFormat(ext)
  if (!format) return null

  setupIpcOnce()

  const run = async (): Promise<Buffer | null> => {
    const fromMain = await renderViaMainWindow(absFilePath, ext)
    if (fromMain?.length) return fromMain
    return renderViaHiddenWindow(absFilePath, ext)
  }

  const done = thumbRenderQueue.then(run, run)
  thumbRenderQueue = done.then(
    () => undefined,
    () => undefined
  )
  return done
}

/** Wait until main renderer exposes __assetVaultRenderModelSnapshot (or timeout). */
export async function waitForModelSnapshotBridge(maxMs = 120_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const win = getMainBrowserWindow()
    if (win && !win.isDestroyed() && !win.webContents.isLoading()) {
      try {
        const ready = await win.webContents.executeJavaScript(
          'typeof window.__assetVaultRenderModelSnapshot === "function"'
        )
        if (ready) return true
      } catch {
        /* renderer not ready */
      }
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  console.warn('[ModelThumbnail] snapshot bridge not ready within timeout')
  return false
}

