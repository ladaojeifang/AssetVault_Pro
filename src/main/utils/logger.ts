/**
 * Main-process logger with level filtering & dev-time enhancements.
 *
 * Usage (new code):
 *   import { logger } from '@/utils/logger'
 *   const log = logger.tag('MyModule')
 *   log.error('something broke', err)
 *   log.warn('unusual but ok', details)
 *   log.info('lifecycle event')
 *   log.debug('verbose detail', data)
 *
 * Existing `console.*` calls are automatically filtered once
 * `installConsoleOverride()` is called (done in index.ts at startup).
 *
 * Dev-mode enhancements (when isDev=true):
 *   - Every line is prefixed with a [HH:MM:SS.mmm] timestamp.
 *   - Renderer console messages can be relayed via relayRendererConsole().
 *
 * Level control (highest priority first):
 *   1. Env var  ASSETVAULT_LOG_LEVEL=debug|info|warn|error
 *   2. App preferences  logLevel field
 *   3. Default: "debug" in dev, "info" in production
 */

import { type LogLevel, shouldLog, parseLogLevel, defaultLogLevel } from '@/shared/logLevel'
import { app } from 'electron'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentLevel: LogLevel = defaultLogLevel(!app.isPackaged)
let _isDev = !app.isPackaged

// Saved originals so we can still forward to the real streams.
const _orig = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  log: console.log.bind(console),
  debug: console.debug.bind(console)
}

// ---------------------------------------------------------------------------
// Dev-time helpers
// ---------------------------------------------------------------------------

/** zero-pad a number to 2 digits */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Format current time as HH:MM:SS.mmm */
function timestamp(): string {
  const d = new Date()
  const h = pad2(d.getHours())
  const m = pad2(d.getMinutes())
  const s = pad2(d.getSeconds())
  const ms = d.getMilliseconds()
  return `${h}:${m}:${s}.${String(ms).padStart(3, '0')}`
}

/** Build a prefix string for a given log method name. */
function prefix(method: string): string {
  const ts = timestamp()
  return method === 'error'
    ? `\x1b[31m[${ts}]\x1b[0m`    // red timestamp for errors
    : method === 'warn'
      ? `\x1b[33m[${ts}]\x1b[0m`   // yellow for warnings
      : `\x1b[90m[${ts}]\x1b[0m`   // grey for info/debug
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Get the active log level. */
export function getLogLevel(): LogLevel {
  return currentLevel
}

/** Check if we are in dev mode (used by relayRendererConsole). */
export function isDevMode(): boolean {
  return _isDev
}

/**
 * Set the log level at runtime.
 * Automatically re-applies the console filter.
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level
  installConsoleOverride()
}

/**
 * Initialise the logger.
 * Called once at startup in index.ts with the best-known level.
 *
 * Priority:
 *   1. process.env.ASSETVAULT_LOG_LEVEL
 *   2. prefs logLevel (passed from readAppPreferences)
 *   3. defaultLogLevel(isDev)
 *
 * @param prefsLevel  Optional persisted log level from app preferences.
 * @param isDev       Whether we're in dev mode (defaults to !app.isPackaged).
 */
export function initLogger(prefsLevel?: LogLevel, isDev?: boolean): void {
  if (typeof isDev === 'boolean') _isDev = isDev
  const envLevel = parseLogLevel(process.env.ASSETVAULT_LOG_LEVEL, null as unknown as LogLevel)
  if (envLevel) {
    currentLevel = envLevel
  } else if (prefsLevel) {
    currentLevel = prefsLevel
  } else {
    currentLevel = defaultLogLevel(_isDev)
  }
  installConsoleOverride()
  _orig.log(`\x1b[36m[Logger]\x1b[0m Log level set to "${currentLevel}" (env=${!!envLevel}, prefs=${!!prefsLevel}, dev=${_isDev})`)
}

/**
 * Relay a renderer-process console message to the main-process terminal.
 * Call this from the `console-message` WebContents event handler.
 *
 * @param source  Short label, e.g. "Renderer" or "AI Canvas"
 * @param level   Electron ConsoleMessageLevel (0=verbose, 1=info, 2=warning, 3=error)
 * @param message The string message from the renderer
 */
export function relayRendererConsole(
  source: string,
  level: 'verbose' | 'info' | 'warning' | 'error',
  message: string
): void {
  if (!_isDev) return // never leak renderer logs in production

  const tag = `\x1b[35m[${source}]\x1b[0m`
  switch (level) {
    case 'error':
      if (!shouldLog('error', currentLevel)) return
      _orig.error(prefix('error'), tag, message)
      break
    case 'warning':
      if (!shouldLog('warn', currentLevel)) return
      _orig.warn(prefix('warn'), tag, message)
      break
    case 'info':
      if (!shouldLog('info', currentLevel)) return
      _orig.log(prefix('log'), tag, message)
      break
    case 'verbose':
      if (!shouldLog('debug', currentLevel)) return
      _orig.debug(prefix('debug'), tag, message)
      break
  }
}

/**
 * Override global console methods so ALL existing console.* calls
 * are automatically filtered by the current log level.
 *
 * In dev mode, every line is prefixed with a [HH:MM:SS.mmm] timestamp.
 */
export function installConsoleOverride(): void {
  const lvl = currentLevel
  const dev = _isDev

  // console.debug → only when level is "debug"
  console.debug = function (...args: unknown[]) {
    if (!shouldLog('debug', lvl)) return
    if (dev) {
      _orig.debug(prefix('debug'), ...args)
    } else {
      _orig.debug(...args)
    }
  }

  // console.log = info level
  console.log = function (...args: unknown[]) {
    if (!shouldLog('info', lvl)) return
    if (dev) {
      _orig.log(prefix('log'), ...args)
    } else {
      _orig.log(...args)
    }
  }

  // console.warn
  console.warn = function (...args: unknown[]) {
    if (!shouldLog('warn', lvl)) return
    if (dev) {
      _orig.warn(prefix('warn'), ...args)
    } else {
      _orig.warn(...args)
    }
  }

  // console.error → always shown (level "error" is the minimum)
  console.error = function (...args: unknown[]) {
    if (!shouldLog('error', lvl)) return
    if (dev) {
      _orig.error(prefix('error'), ...args)
    } else {
      _orig.error(...args)
    }
  }
}

// ---------------------------------------------------------------------------
// Dev-mode IPC call tracing
// ---------------------------------------------------------------------------

/**
 * Patch ipcMain.handle / ipcMain.on to log every IPC call at debug level.
 * Only active in dev mode. Call AFTER registerIpcHandlers() to avoid
 * double-wrapping.
 *
 * Usage (in registerIpcHandlers or index.ts):
 *   import { installIpcTrace } from '../utils/logger'
 *   installIpcTrace(ipcMain)
 */
export function installIpcTrace(ipc: Electron.IpcMain): void {
  if (!_isDev) return

  const _origHandle = ipc.handle.bind(ipc)
  const _origOn = ipc.on.bind(ipc)

  // Trace ipcMain.handle — synchronous invoke from renderer
  ipc.handle = function (channel: string, listener: (...args: any[]) => any): void {
    const wrapped = async (...args: any[]) => {
      const start = performance.now()
      console.debug(`\x1b[2m[IPC] → ${channel}\x1b[0m`, args.length > 0 ? truncArgs(args) : '')
      try {
        const result = await (listener as any)(...args)
        const ms = (performance.now() - start).toFixed(1)
        console.debug(`\x1b[2m[IPC] ← ${channel}\x1b[0m \x1b[32mOK\x1b[0m (${ms}ms)`)
        return result
      } catch (err) {
        const ms = (performance.now() - start).toFixed(1)
        const msg = err instanceof Error ? err.message : String(err)
        console.debug(`\x1b[2m[IPC] ← ${channel}\x1b[0m \x1b[31mERR\x1b[0m (${ms}ms) \x1b[31m${msg}\x1b[0m`)
        throw err
      }
    }
    _origHandle(channel, wrapped as any)
  }

  // Trace ipcMain.on — asynchronous events from renderer
  ipc.on = function (channel: string, listener: (...args: any[]) => void): Electron.IpcMain {
    const wrapped = (...args: any[]) => {
      console.debug(`\x1b[2m[IPC] ~ ${channel}\x1b[0m`, args.length > 0 ? truncArgs(args) : '')
      ;(listener as any)(...args)
    }
    return _origOn(channel, wrapped as any)
  }

  console.debug(`\x1b[2m[IPC] Trace installed — all invoke/on calls logged at debug level\x1b[0m`)
}

/** Truncate args for log display (avoid huge payloads). */
function truncArgs(args: unknown[]): unknown {
  if (args.length === 0) return ''
  const first = args[0]
  if (typeof first === 'object' && first !== null) {
    return `{${Object.keys(first as Record<string, unknown>).join(',')}}`
  }
  if (typeof first === 'string' && first.length > 80) {
    return `"${first.slice(0, 80)}…"`
  }
  return args.length === 1 ? first : JSON.stringify(args).slice(0, 120)
}

// ---------------------------------------------------------------------------
// Tagged logger — recommended for NEW code
// ---------------------------------------------------------------------------

export interface TaggedLogger {
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

/**
 * Create a tagged logger instance.
 * Tags are automatically prefixed to every message so you don't need
 * manual `[Tag]` strings.
 *
 * In dev mode, a timestamp prefix is also added.
 *
 * @example
 *   const log = logger.tag('ThumbnailService')
 *   log.info('generating thumb for', assetId)
 *   // → [14:32:05.127] [ThumbnailService] generating thumb for abc123
 */
function tag(tag: string): TaggedLogger {
  const tagPrefix = `\x1b[36m[${tag}]\x1b[0m`
  const dev = _isDev
  return {
    error: (...args: unknown[]) => {
      if (!shouldLog('error', currentLevel)) return
      if (dev) _orig.error(prefix('error'), tagPrefix, ...args)
      else _orig.error(tagPrefix, ...args)
    },
    warn: (...args: unknown[]) => {
      if (!shouldLog('warn', currentLevel)) return
      if (dev) _orig.warn(prefix('warn'), tagPrefix, ...args)
      else _orig.warn(tagPrefix, ...args)
    },
    info: (...args: unknown[]) => {
      if (!shouldLog('info', currentLevel)) return
      if (dev) _orig.log(prefix('log'), tagPrefix, ...args)
      else _orig.log(tagPrefix, ...args)
    },
    debug: (...args: unknown[]) => {
      if (!shouldLog('debug', currentLevel)) return
      if (dev) _orig.debug(prefix('debug'), tagPrefix, ...args)
      else _orig.debug(tagPrefix, ...args)
    }
  }
}

export const logger = { tag } as const
