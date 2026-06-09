import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { initLogger, setLogLevel, relayRendererConsole } from './utils/logger'
import { initDatabase, flushDatabase, getDatabase } from './db'
import { BETTER_SQLITE_REBUILD_HINT, isBetterSqliteBindingsError, probeBetterSqliteNative } from './db/betterSqliteNative'
import { prepareOnStartup } from './services/libraryBundle'
import { readAppPreferences, applyAppPreferencesToRuntime } from './services/appPreferencesStore'
import { getThumbnailService } from './services/ThumbnailService'
import { runLegacyPathsMigrationIfNeeded } from './services/libraryMigration'
import { repairOrphanItemPacks } from './services/repairOrphanItemPacks'
import { processPending3dThumbnails } from './services/regenerateModelThumbnails'
import { processPendingEmbeddedDccThumbnails } from './services/regenerateEmbeddedDccThumbnails'
import { processPendingTextPreviewThumbnails } from './services/regenerateTextPreviewThumbnails'
import { markStartupThumbnailPhaseComplete, runDeferredThumbnailWork } from './services/thumbnailStartup'
import { migrateOriginalExtToDisplayFilenames } from './services/migrateStorageFileNames'
import { registerIpcHandlers } from './ipc'
import { setupGlobalErrorHandlers } from './services/ErrorHandler'
import { getHotkeyManager } from './services/HotkeyManager'
import { initModelThumbnailRenderer, warmHiddenThumbnailWindow } from './services/modelThumbnailRenderer'
import { initSvgThumbnailRenderer, warmHiddenSvgThumbnailWindow } from './services/svgThumbnailRenderer'
import { ensureExrsInitialized } from './services/exrExrsDecoder'
import { setMainBrowserWindow } from './services/mainWindowRef'
import { attachMainWindowLifecycle } from './services/aiCanvasWindow'
import { quitApplicationFromUserClose, performAppShutdown, isAppQuitting } from './services/appShutdown'
import { applyWebApiFromPreferences } from './api/webApiRuntime'
import {
  registerModelFileProtocol,
  setupModelFileProtocolHandler
} from './services/modelFileProtocol'
import {
  registerExrPreviewProtocol,
  setupExrPreviewProtocolHandler
} from './services/exrPreviewCache'
import { resolveAppIcon } from './appIcon'
import { purgeExpiredFullPageSessions } from './services/fullPageSession/fullPageSessionStore'
import { purgeExpiredArticleBundleSessions } from './services/articleBundleSession/articleBundleSessionStore'
import { probeYtdlpOnStartup } from './services/pageVideoImport/ytdlpBinary'
import { initPageVideoImportOnStartup } from './services/pageVideoImport/pageVideoImportService'

registerModelFileProtocol()
registerExrPreviewProtocol()

const isDev = !app.isPackaged

// Initialize logger BEFORE any console.* calls so level filtering takes effect.
// At this point we don't have app preferences yet — initLogger uses
// ASSETVAULT_LOG_LEVEL env var > dev/prod default.
initLogger()

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

/**
 * Chromium default cache lives under userData and can fail on Windows when another
 * instance holds the lock ("Unable to move the cache" / 0x5). Pin dedicated dirs
 * before any BrowserWindow is created.
 */
function configureChromiumCacheDirs(): void {
  try {
    const base = app.getPath('userData')
    const diskCache = join(base, 'chromium-disk-cache')
    const gpuCache = join(base, 'chromium-gpu-cache')
    mkdirSync(diskCache, { recursive: true })
    mkdirSync(gpuCache, { recursive: true })
    app.commandLine.appendSwitch('disk-cache-dir', diskCache)
    app.commandLine.appendSwitch('gpu-shader-disk-cache-dir', gpuCache)
    if (process.platform === 'win32') {
      // Avoid GPU shader disk cache races when dev restarts overlap a stale process.
      app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
    }
  } catch (e) {
    console.warn('[Main] Chromium cache dir setup skipped:', e)
  }
}

pinUserDataForDev()
configureChromiumCacheDirs()

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

let signalShutdownStarted = false
async function shutdownFromSignal(signal: string): Promise<void> {
  if (signalShutdownStarted) return
  signalShutdownStarted = true
  console.log(`[Main] ${signal} — shutting down…`)
  await performAppShutdown()
  process.exit(0)
}

process.on('SIGINT', () => void shutdownFromSignal('SIGINT'))
process.on('SIGTERM', () => void shutdownFromSignal('SIGTERM'))

function createWindow(): BrowserWindow {
  const appIcon = resolveAppIcon()
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0F1117',
    ...(appIcon && !appIcon.isEmpty() ? { icon: appIcon } : {}),
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

  // 开发模式：将渲染进程 console 消息转发到主进程终端
  // 已知 Chromium DevTools 内部 bug（与业务代码无关）
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (
      message.includes('dragEvent is not defined') ||
      (message.includes('Failed to fetch') && message.includes('devtools'))
    ) {
      return
    }
    // Dev mode: relay renderer console → main terminal with [Renderer] tag
    const levelName =
      level === 3 ? 'error' : level === 2 ? 'warning' : level === 1 ? 'info' : 'verbose'
    relayRendererConsole('Renderer', levelName, message)
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

  mainWindow.on('close', (event) => {
    if (isAppQuitting()) return
    event.preventDefault()
    void quitApplicationFromUserClose()
  })

  return mainWindow
}

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

if (gotSingleInstanceLock) {
  app.whenReady().then(async () => {
    const startupStart = performance.now()
    console.debug('[Startup] app.whenReady() fired')

    setupModelFileProtocolHandler()
    setupExrPreviewProtocolHandler()

    // Set app user model id for windows
    app.setAppUserModelId('com.assetvault.app')

    // Setup global error handling (uncaughtException, unhandledRejection)
    setupGlobalErrorHandlers()

    const userData = app.getPath('userData')
    console.debug(`[Startup] userData: ${userData}`)
    const { libraryRoot, dbPath } = prepareOnStartup(userData)
    console.debug(`[Startup] prepareOnStartup done in ${(performance.now() - startupStart).toFixed(0)}ms`)
    getThumbnailService().setLibraryRoot(libraryRoot)
    readAppPreferences()
    applyAppPreferencesToRuntime()

    try {
      probeBetterSqliteNative()
    } catch (e) {
      const msg = isBetterSqliteBindingsError(e)
        ? `无法加载数据库原生模块。\n\n${BETTER_SQLITE_REBUILD_HINT}`
        : e instanceof Error
          ? e.message
          : String(e)
      console.error('[Main] better-sqlite3 probe failed:', e)
      dialog.showErrorBox('无法启动数据库', msg)
      app.quit()
      return
    }

    try {
      await initDatabase(dbPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Main] initDatabase failed:', e)
      dialog.showErrorBox('资料库无法打开', msg)
      app.quit()
      return
    }
    console.debug(`[Startup] initDatabase done in ${(performance.now() - startupStart).toFixed(0)}ms`)
    await runLegacyPathsMigrationIfNeeded()
    await migrateOriginalExtToDisplayFilenames()
    await repairOrphanItemPacks()
    await flushDatabase()
    console.debug(`[Startup] migrations + flush done in ${(performance.now() - startupStart).toFixed(0)}ms`)

    console.log('[Library] Active library root:', libraryRoot)

    const purgedFp = purgeExpiredFullPageSessions()
    if (purgedFp > 0) {
      console.log(`[FullPageSession] Purged ${purgedFp} expired session(s) on startup`)
    }
    const purgedAb = purgeExpiredArticleBundleSessions()
    if (purgedAb > 0) {
      console.log(`[ArticleBundleSession] Purged ${purgedAb} expired session(s) on startup`)
    }

    probeYtdlpOnStartup()
    initPageVideoImportOnStartup()

    initModelThumbnailRenderer()
    warmHiddenThumbnailWindow()
    initSvgThumbnailRenderer()
    warmHiddenSvgThumbnailWindow()
    void ensureExrsInitialized().catch((e) => {
      console.warn('[Exr] WASM init deferred:', e)
    })

    // Register IPC handlers
    registerIpcHandlers(ipcMain)

    try {
      await applyWebApiFromPreferences()
    } catch (e) {
      console.error('[WebAPI] Failed to start:', e)
    }

    // OS-wide shortcuts: only when ASSETVAULT_GLOBAL_HOTKEYS=1 (otherwise they steal keys from IDE/browser)
    if (process.env.ASSETVAULT_GLOBAL_HOTKEYS === '1') {
      getHotkeyManager().registerAll()
      console.log('[Hotkeys] OS-wide globalShortcut enabled (ASSETVAULT_GLOBAL_HOTKEYS=1)')
    } else {
      console.log('[Hotkeys] Using window-local shortcuts only (set ASSETVAULT_GLOBAL_HOTKEYS=1 for OS-wide)')
    }

    createWindow()
    console.debug(`[Startup] createWindow done, total ${(performance.now() - startupStart).toFixed(0)}ms`)

    void (async () => {
      const database = getDatabase()
      if (database) {
        await processPending3dThumbnails(database)
        await processPendingEmbeddedDccThumbnails(database)
        await processPendingTextPreviewThumbnails(database)
        markStartupThumbnailPhaseComplete()
        await runDeferredThumbnailWork()
      }
    })()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isAppQuitting()) {
    void quitApplicationFromUserClose()
  }
})

app.on('before-quit', (event) => {
  if (!isAppQuitting()) {
    event.preventDefault()
    void quitApplicationFromUserClose()
  }
})

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' })
  )
})
