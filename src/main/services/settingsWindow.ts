import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { getMainBrowserWindow } from './mainWindowRef'

const isDev = !app.isPackaged

let settingsWindow: BrowserWindow | null = null

function settingsLoadTarget(): { url?: string; file?: string; hash?: string } {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    return { url: `${process.env['ELECTRON_RENDERER_URL']}#/settings` }
  }
  return { file: join(__dirname, '../renderer/index.html'), hash: '/settings' }
}

function createSettingsWindow(): BrowserWindow {
  const parent = getMainBrowserWindow()
  const bounds = parent?.getBounds() ?? { x: 160, y: 100, width: 1280, height: 840 }

  const win = new BrowserWindow({
    x: bounds.x + 64,
    y: bounds.y + 64,
    width: 860,
    height: 640,
    minWidth: 640,
    minHeight: 480,
    show: false,
    frame: true,
    autoHideMenuBar: true,
    title: 'AssetVault Pro — Settings',
    backgroundColor: '#0D0F14',
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

  const target = settingsLoadTarget()
  if (target.url) {
    void win.loadURL(target.url)
  } else if (target.file) {
    void win.loadFile(target.file, { hash: target.hash })
  }

  win.on('closed', () => {
    if (settingsWindow === win) settingsWindow = null
  })

  return win
}

/** Open or focus the standalone settings window. */
export function openSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore()
    settingsWindow.show()
    settingsWindow.focus()
    return settingsWindow
  }

  settingsWindow = createSettingsWindow()
  return settingsWindow
}

export function getSettingsWindow(): BrowserWindow | null {
  if (!settingsWindow || settingsWindow.isDestroyed()) return null
  return settingsWindow
}

export function closeSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close()
  }
}
