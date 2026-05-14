import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { initDatabase, flushDatabase, stopDevAutosave } from './db'
import { registerIpcHandlers } from './ipc'
import { setupGlobalErrorHandlers } from './services/ErrorHandler'
import { getHotkeyManager } from './services/HotkeyManager'
import { getFileWatcher } from './services/FileWatcher'

const isDev = !app.isPackaged

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
    // 开发模式下自动打开开发者工具
    if (isDev) {
      mainWindow.webContents.openDevTools()
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

  return mainWindow
}

app.whenReady().then(async () => {
  // Set app user model id for windows
  app.setAppUserModelId('com.assetvault.app')

  // Setup global error handling (uncaughtException, unhandledRejection)
  setupGlobalErrorHandlers()

  // Initialize database
  await initDatabase()

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
