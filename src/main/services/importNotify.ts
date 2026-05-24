import { BrowserWindow } from 'electron'

/** Tell all renderer windows to refresh asset lists (after import / thumb ready). */
export function notifyAllWindowsAssetsImported(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      try {
        w.webContents.send('assets:imported')
      } catch {
        /* ignore */
      }
    }
  }
}
