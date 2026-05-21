import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { getMainBrowserWindow } from './mainWindowRef'

const isDev = !app.isPackaged

let aiCanvasWindow: BrowserWindow | null = null

function canvasLoadUrl(): string {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}#/ai-canvas`
  }
  return join(__dirname, '../renderer/index.html')
}

function sendNavigate(canvasId?: string | null): void {
  if (!aiCanvasWindow || aiCanvasWindow.isDestroyed()) return
  aiCanvasWindow.webContents.send('ai-canvas:navigate', { canvasId: canvasId ?? null })
}

function createAiCanvasWindow(): BrowserWindow {
  const parent = getMainBrowserWindow()
  const bounds = parent?.getBounds() ?? { x: 120, y: 80, width: 1280, height: 840 }

  const win = new BrowserWindow({
    x: bounds.x + 48,
    y: bounds.y + 48,
    width: Math.max(960, bounds.width - 80),
    height: Math.max(640, bounds.height - 80),
    minWidth: 880,
    minHeight: 560,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0F1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.webContents.on('console-message', (_event, _level, message) => {
    if (
      message.includes('dragEvent is not defined') ||
      (message.includes('Failed to fetch') && message.includes('devtools'))
    ) {
      return
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(canvasLoadUrl())
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/ai-canvas' })
  }

  win.on('closed', () => {
    if (aiCanvasWindow === win) aiCanvasWindow = null
  })

  return win
}

/** 打开或聚焦 AI 画布窗口；可选直接进入某画布编辑器 */
export function openAiCanvasWindow(canvasId?: string | null): BrowserWindow {
  if (aiCanvasWindow && !aiCanvasWindow.isDestroyed()) {
    if (aiCanvasWindow.isMinimized()) aiCanvasWindow.restore()
    aiCanvasWindow.show()
    aiCanvasWindow.focus()
    sendNavigate(canvasId)
    return aiCanvasWindow
  }

  aiCanvasWindow = createAiCanvasWindow()
  aiCanvasWindow.webContents.once('did-finish-load', () => {
    sendNavigate(canvasId)
  })
  return aiCanvasWindow
}

export function getAiCanvasWindow(): BrowserWindow | null {
  if (!aiCanvasWindow || aiCanvasWindow.isDestroyed()) return null
  return aiCanvasWindow
}

export function focusMainWindow(): void {
  const main = getMainBrowserWindow()
  if (!main || main.isDestroyed()) return
  if (main.isMinimized()) main.restore()
  main.show()
  main.focus()
}

export function closeAiCanvasWindow(): void {
  if (aiCanvasWindow && !aiCanvasWindow.isDestroyed()) {
    aiCanvasWindow.close()
  }
}

/** 主窗口关闭时一并关闭画布窗口 */
export function attachMainWindowLifecycle(main: BrowserWindow): void {
  main.on('closed', () => {
    closeAiCanvasWindow()
  })
}
