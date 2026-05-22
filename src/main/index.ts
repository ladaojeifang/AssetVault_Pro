import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { initDatabase, flushDatabase, stopDevAutosave, getDatabase } from './db'
import { prepareOnStartup } from './services/libraryBundle'
import { getThumbnailService } from './services/ThumbnailService'
import { runLegacyPathsMigrationIfNeeded } from './services/libraryMigration'
import { repairOrphanItemPacks } from './services/repairOrphanItemPacks'
import { processPending3dThumbnails } from './services/regenerateModelThumbnails'
import { migrateOriginalExtToDisplayFilenames } from './services/migrateStorageFileNames'
import { registerIpcHandlers } from './ipc'
import { setupGlobalErrorHandlers } from './services/ErrorHandler'
import { getHotkeyManager } from './services/HotkeyManager'
import { getFileWatcher } from './services/FileWatcher'
import { initModelThumbnailRenderer, warmHiddenThumbnailWindow } from './services/modelThumbnailRenderer'
import { setMainBrowserWindow } from './services/mainWindowRef'
import { attachMainWindowLifecycle } from './services/aiCanvasWindow'
import {
  registerModelFileProtocol,
  setupModelFileProtocolHandler
} from './services/modelFileProtocol'

registerModelFileProtocol()

const isDev = !app.isPackaged

/**
 * Dev runs sometimes use a generic Electron userData dir, so `active-library.json` appears to reset
 * every `npm run dev`. Pin to the same folder name as production (`assetvault-pro` under appData).
 * Must run before `app.whenReady()` / any `getPath('userData')` use.
 */
function pinUserDataForDev(): void {
  if (app.isPackaged) return
  try {
    app.setName('assetvault-pro')
    const base = app.getPath('appData')
    const stable = join(base, 'assetvault-pro')
    mkdirSync(stable, { recursive: true })
    app.setPath('userData', stable)
    console.log('[Main] Dev userData:', stable)
  } catch (e) {
    console.warn('[Main] Dev userData pin skipped:', e)
  }
}

pinUserDataForDev()

let signalShutdownStarted = false
async function shutdownFromSignal(signal: string): Promise<void> {
  if (signalShutdownStarted) return
  signalShutdownStarted = true
  console.log(`[Main] ${signal} — flushing database…`)
  getHotkeyManager().unregisterAll()
  getFileWatcher().stop()
  stopDevAutosave()
  await flushDatabase().catch((e) => console.error('[Main] flush on signal failed:', e))
  process.exit(0)
}

process.on('SIGINT', () => void shutdownFromSignal('SIGINT'))
process.on('SIGTERM', () => void shutdownFromSignal('SIGTERM'))

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // 开发模式：Detached DevTools 可减少 Chromium 在拖放时误报 dragEvent 的噪音
    if (isDev && process.env.ASSETVAULT_NO_DEVTOOLS !== '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // 已知 Chromium DevTools 内部 bug（与业务代码无关）
  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    if (
      message.includes('dragEvent is not defined') ||
      (message.includes('Failed to fetch') && message.includes('devtools'))
    ) {
      return
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL']
    console.log('[Main] Loading dev URL:', url)
    mainWindow.loadURL(url).then(() => {
      console.log('[Main] Dev URL loaded successfully')
    }).catch((err) => {
      console.error('[Main] Failed to load dev URL:', err.message)
      // Fallback: show error in window
      mainWindow.loadURL(`data:text/html,<html><body><h1 style="color:red">Failed to load dev server: ${err.message}<br>URL: ${url}</h1><p>Make sure npm run dev is running and Vite dev server started.</p></body></html>`)
    })
  } else {
    console.log('[Main] Loading production file...')
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  setMainBrowserWindow(mainWindow)
  attachMainWindowLifecycle(mainWindow)
  mainWindow.on('closed', () => setMainBrowserWindow(null))

  return mainWindow
}

app.whenReady().then(async () => {
  setupModelFileProtocolHandler()

  // Set app user model id for windows
  app.setAppUserModelId('com.assetvault.app')

  // Setup global error handling (uncaughtException, unhandledRejection)
  setupGlobalErrorHandlers()

  const userData = app.getPath('userData')
  const { libraryRoot, dbPath } = prepareOnStartup(userData)
  getThumbnailService().setLibraryRoot(libraryRoot)

  await initDatabase(dbPath)
  await runLegacyPathsMigrationIfNeeded()
  await migrateOriginalExtToDisplayFilenames()
  await repairOrphanItemPacks()
  await flushDatabase()

  console.log('[Library] Active library root:', libraryRoot)

  initModelThumbnailRenderer()
  warmHiddenThumbnailWindow()

  // Register IPC handlers
  registerIpcHandlers(ipcMain)

  // OS-wide shortcuts: only when ASSETVAULT_GLOBAL_HOTKEYS=1 (otherwise they steal keys from IDE/browser)
  if (process.env.ASSETVAULT_GLOBAL_HOTKEYS === '1') {
    getHotkeyManager().registerAll()
    console.log('[Hotkeys] OS-wide globalShortcut enabled (ASSETVAULT_GLOBAL_HOTKEYS=1)')
  } else {
    console.log('[Hotkeys] Using window-local shortcuts only (set ASSETVAULT_GLOBAL_HOTKEYS=1 for OS-wide)')
  }

  createWindow()

  void (async () => {
    const database = getDatabase()
    if (database) {
      await processPending3dThumbnails(database)
    }
  })()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  // Cleanup: unregister shortcuts before quit
  getHotkeyManager().unregisterAll()

  getFileWatcher().stop()

  stopDevAutosave()
  // Persist sql.js database to disk before exit (flush pending debounced writes)
  await flushDatabase()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  getHotkeyManager().unregisterAll()
  getFileWatcher().stop()
  stopDevAutosave()
  await flushDatabase()
})

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' })
  )
})
