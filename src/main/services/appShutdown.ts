import { app, BrowserWindow } from 'electron'
import { closeDatabase, flushDatabase } from '../db'
import { stopApiServer } from '../api/server'
import { getHotkeyManager } from './HotkeyManager'
import { getFileWatcher } from './FileWatcher'
import { closeAiCanvasWindow } from './aiCanvasWindow'
import { destroyModelThumbnailWindow } from './modelThumbnailRenderer'
import { destroySvgThumbnailWindow } from './svgThumbnailRenderer'
import { clearExrPreviewCache } from './exrPreviewCache'

let shutdownPromise: Promise<void> | null = null
let quitting = false

export function isAppQuitting(): boolean {
  return quitting
}

/**
 * Flush DB, stop services, destroy auxiliary windows, then quit the app.
 * Safe to call multiple times (runs once).
 */
export function performAppShutdown(): Promise<void> {
  if (!shutdownPromise) {
    shutdownPromise = runShutdown()
  }
  return shutdownPromise
}

async function runShutdown(): Promise<void> {
  console.log('[Main] Application shutdown started')
  getHotkeyManager().unregisterAll()
  getFileWatcher().stop()
  await stopApiServer().catch((e) => console.error('[Main] stopApiServer failed:', e))
  await flushDatabase().catch((e) => console.error('[Main] flushDatabase failed:', e))
  await closeDatabase().catch((e) => console.error('[Main] closeDatabase failed:', e))
  closeAiCanvasWindow()
  destroyModelThumbnailWindow()
  destroySvgThumbnailWindow()
  clearExrPreviewCache()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.destroy()
    }
  }
  console.log('[Main] Application shutdown finished')
}

/**
 * User closed the main window (or equivalent): persist data and exit all processes.
 */
export async function quitApplicationFromUserClose(): Promise<void> {
  if (quitting) return
  quitting = true
  await performAppShutdown()
  app.quit()
}
