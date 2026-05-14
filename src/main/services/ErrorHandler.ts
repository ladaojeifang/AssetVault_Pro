import { BrowserWindow, dialog } from 'electron'
import crypto from 'node:crypto'
import { join } from 'path'

/**
 * Global Error Handler & Boundary System
 * Catches unhandled errors, shows user-friendly toasts, and logs details
 */

type ErrorLevel = 'info' | 'warning' | 'error' | 'critical'

interface ErrorEntry {
  id: string
  level: ErrorLevel
  message: string
  detail?: string
  timestamp: Date
  context?: string
}

class ErrorHandler {
  private errors: ErrorEntry[] = []
  private maxLogSize = 500

  /**
   * Handle an error with appropriate UI feedback
   */
  handle(error: unknown, context?: string): void {
    const entry = this.createEntry(error, context)
    this.errors.push(entry)

    // Trim log if too large
    if (this.errors.length > this.maxLogSize) {
      this.errors = this.errors.slice(-this.maxLogSize)
    }

    // Log to console with structured format
    const prefix = `[Error:${entry.level.toUpperCase()}]`
    switch (entry.level) {
      case 'critical':
        console.error(`${prefix} ${entry.message}`, error)
        break
      case 'error':
        console.error(`${prefix} ${entry.message}`, entry.detail || '')
        break
      case 'warning':
        console.warn(`${prefix} ${entry.message}`)
        break
      default:
        console.info(`${prefix} ${entry.message}`)
    }

    // Send to renderer for toast notification
    this.notifyRenderer(entry)

    // For critical errors, show dialog
    if (entry.level === 'critical') {
      this.showCriticalDialog(entry)
    }
  }

  /**
   * Create a structured error entry from unknown input
   */
  private createEntry(error: unknown, context?: string): ErrorEntry {
    let message = 'Unknown error'
    let detail: string | undefined
    let level: ErrorLevel = 'error'

    if (typeof error === 'string') {
      message = error
    } else if (error instanceof Error) {
      message = error.message
      detail = error.stack
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as { message?: unknown }).message ?? 'Unknown object error')
    }

    // Classify severity based on message content
    const lowerMsg = message.toLowerCase()
    if (
      lowerMsg.includes('enoent') ||
      lowerMsg.includes('not found') ||
      lowerMsg.includes('file not found')
    ) {
      level = 'warning'
    } else if (
      lowerMsg.includes('eacces') ||
      lowerMsg.includes('permission') ||
      lowerMsg.includes('denied')
    ) {
      level = 'warning'
    } else if (
      lowerMsg.includes('database') ||
      lowerMsg.includes('sqlite') ||
      lowerMsg.includes('corrupt')
    ) {
      level = 'critical'
    } else if (
      lowerMsg.includes('out of memory') ||
      lowerMsg.includes('heap')
    ) {
      level = 'critical'
    }

    return {
      id: crypto.randomUUID(),
      level,
      message,
      detail,
      timestamp: new Date(),
      context
    }
  }

  /**
   * Send error notification to all renderer windows for toast display
   */
  private notifyRenderer(entry: ErrorEntry): void {
    try {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('notification:error', {
            level: entry.level,
            message: entry.message,
            id: entry.id
          })
        }
      }
    } catch {
      // No windows available, ignore send failure
    }
  }

  /**
   * Show a modal dialog for critical errors
   */
  private showCriticalDialog(entry: ErrorEntry): void {
    dialog.showErrorBox(
      `AssetVault Pro - Critical Error`,
      `${entry.message}\n\n${entry.detail || ''}\n\nContext: ${entry.context || 'Unknown'}\nTime: ${entry.timestamp.toISOString()}`
    )
  }

  /**
   * Get recent errors for debugging
   */
  getRecent(count = 20): ErrorEntry[] {
    return this.errors.slice(-count)
  }

  /**
   * Clear error log
   */
  clear(): void {
    this.errors = []
  }

  /**
   * Export errors as JSON for bug reports
   */
  exportReport(): string {
    return JSON.stringify(
      {
        version: require('../../package.json').version,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        totalErrors: this.errors.length,
        errors: this.errors.map((e) => ({
          ...e,
          timestamp: e.timestamp.toISOString()
        }))
      },
      null,
      2
    )
  }
}

// Singleton
let instance: ErrorHandler | null = null

export function getErrorHandler(): ErrorHandler {
  if (!instance) {
    instance = new ErrorHandler()
  }
  return instance
}

/**
 * Global unhandled exception handlers - call once at app startup
 */
export function setupGlobalErrorHandlers(): void {
  const handler = getErrorHandler()

  process.on('uncaughtException', (error) => {
    handler.handle(error, 'uncaughtException')
  })

  process.on('unhandledRejection', (reason) => {
    handler.handle(reason, 'unhandledRejection')
  })
}
