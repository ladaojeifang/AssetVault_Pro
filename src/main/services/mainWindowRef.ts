import type { BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null

export function setMainBrowserWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export function getMainBrowserWindow(): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) return null
  return mainWindow
}
