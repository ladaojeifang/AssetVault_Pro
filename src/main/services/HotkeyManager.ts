import { globalShortcut, BrowserWindow } from 'electron'

/**
 * Optional OS-wide shortcuts via Electron `globalShortcut`.
 *
 * `globalShortcut` is OS-level: keys are intercepted even when another app (IDE, browser)
 * is focused, which breaks normal typing and common shortcuts (Ctrl+A, Space, Delete, F5).
 *
 * Default app startup does not call `registerAll()` — see `main/index.ts`.
 * When `ASSETVAULT_GLOBAL_HOTKEYS=1`, only chord shortcuts are registered here; keys that
 * must stay contextual (`select-all`, `delete`, `refresh`, `preview`) remain renderer-only
 * in `useHotkeys.ts`.
 */
interface HotkeyConfig {
  id: string
  accelerator: string
  description: string
  handler: () => void | Promise<void>
}

const DEFAULT_HOTKEYS: HotkeyConfig[] = [
  {
    id: 'search',
    accelerator: 'CommandOrCtrl+K',
    description: 'Focus search bar',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:focus-search')
    }
  },
  {
    id: 'import-files',
    accelerator: 'CommandOrCtrl+I',
    description: 'Import files',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:import-files')
    }
  },
  {
    id: 'import-folder',
    accelerator: 'CommandOrCtrl+Shift+O',
    description: 'Import folder',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:import-folder')
    }
  },
  {
    id: 'toggle-sidebar',
    accelerator: 'CommandOrCtrl+B',
    description: 'Toggle sidebar',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:toggle-sidebar')
    }
  },
  {
    id: 'toggle-detail-panel',
    accelerator: 'CommandOrCtrl+D',
    description: 'Toggle detail panel',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:toggle-detail')
    }
  },
  {
    id: 'grid-view',
    accelerator: 'CommandOrCtrl+G',
    description: 'Switch to grid view',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:view-grid')
    }
  },
  {
    id: 'list-view',
    accelerator: 'CommandOrCtrl+Shift+G',
    description: 'Switch to list view',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:view-list')
    }
  },
  {
    id: 'select-all',
    accelerator: 'CommandOrCtrl+A',
    description: 'Select all assets',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:select-all')
    }
  },
  {
    id: 'delete-selected',
    accelerator: 'Delete',
    description: 'Delete selected assets',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:delete-selected')
    }
  },
  {
    id: 'settings',
    accelerator: 'CommandOrCtrl+,',
    description: 'Open settings',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:open-settings')
    }
  },
  {
    id: 'refresh',
    accelerator: 'F5',
    description: 'Refresh asset view',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:refresh')
    }
  },
  {
    id: 'preview',
    accelerator: 'Space',
    description: 'Preview selected asset',
    handler: async () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) win.webContents.send('hotkey:preview')
    }
  }
]

class HotkeyManager {
  private registered: Map<string, HotkeyConfig> = new Map()
  private userOverrides: Map<string, string> = new Map()

  /**
   * Register all default hotkeys
   */
  registerAll(): void {
    this.unregisterAll()

    /** Never register as OS-wide — they break typing / system behavior in other apps. */
    const rendererOnly = new Set(['select-all', 'delete-selected', 'refresh', 'preview'])

    for (const hotkey of DEFAULT_HOTKEYS) {
      if (rendererOnly.has(hotkey.id)) continue

      const accelerator =
        this.userOverrides.get(hotkey.id) || hotkey.accelerator

      const success = globalShortcut.register(accelerator, hotkey.handler)

      if (success) {
        this.registered.set(hotkey.id, { ...hotkey, accelerator })
        console.log(`[Hotkeys] Registered: ${accelerator} -> ${hotkey.description}`)
      } else {
        console.warn(
          `[Hotkeys] Failed to register: ${accelerator} (${hotkey.description})`
        )
      }
    }

    console.log(`[Hotkeys] Total registered: ${this.registered.size}/${DEFAULT_HOTKEYS.length - rendererOnly.size}`)
  }

  /**
   * Unregister all shortcuts
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll()
    this.registered.clear()
  }

  /**
   * Get list of all configured hotkeys for settings UI
   */
  getHotkeyList(): Array<{
    id: string
    accelerator: string
    description: string
  }> {
    return Array.from(this.registered.values()).map((h) => ({
      id: h.id,
      accelerator: h.accelerator,
      description: h.description
    }))
  }

  /**
   * Update a hotkey binding (user preference)
   */
  override(hotkeyId: string, newAccelerator: string): boolean {
    // Validate format first
    try {
      const existing = this.registered.get(hotkeyId)
      if (!existing) return false

      // Unregister old binding
      globalShortcut.unregister(existing.accelerator)

      // Register new binding
      const success = globalShortcut.register(newAccelerator, existing.handler)

      if (success) {
        this.userOverrides.set(hotkeyId, newAccelerator)
        this.registered.set(hotkeyId, { ...existing, accelerator: newAccelerator })

        // Persist to settings storage
        this.persistOverrides()
        return true
      } else {
        // Re-register old one on failure
        globalShortcut.register(existing.accelerator, existing.handler)
        console.error(
          `[Hotkeys] Failed to override "${hotkeyId}" with "${newAccelerator}"`
        )
        return false
      }
    } catch (error) {
      console.error('[Hotkeys] Override error:', error)
      return false
    }
  }

  private persistOverrides(): void {
    const overrides = Object.fromEntries(this.userOverrides)
    // Store in electron-store or localStorage equivalent
    try {
      const { app } = require('electron')
      const fs = require('fs')
      const path = require('path')

      const settingsPath = join(app.getPath('userData'), 'hotkeys.json')
      fs.writeFileSync(settingsPath, JSON.stringify(overrides, null, 2))
    } catch {
      // Storage not available yet
    }
  }

  loadOverrides(): void {
    try {
      const { app } = require('electron')
      const fs = require('fs')
      const path = require('path') // eslint-disable-line no-unused-vars

      const settingsPath = join(app.getPath('userData'), 'hotkeys.json')
      if (existsSyncSync(settingsPath)) {
        const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
        for (const [id, accel] of Object.entries(data)) {
          this.userOverrides.set(id, accel as string)
        }
      }
    } catch {
      // No saved overrides
    }
  }
}

function existsSyncSync(p: string): boolean {
  try { require('fs').existsSync(p); return true } catch { return false }
}

function join(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, require('path').sep)
}

// Singleton
let instance: HotkeyManager | null = null

export function getHotkeyManager(): HotkeyManager {
  if (!instance) {
    instance = new HotkeyManager()
    instance.loadOverrides()
  }
  return instance
}

export { DEFAULT_HOTKEYS }
export type { HotkeyConfig }
