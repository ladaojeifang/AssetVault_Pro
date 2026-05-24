import chokidar from 'chokidar'
import { basename } from 'path'
import { statSync, existsSync } from 'fs'
import { db, persistDatabase } from '../db'
import { assets } from '../db/schema'
import { eq } from 'drizzle-orm'
import { importSingleAsset } from './importSingleAsset'
import { notifyAllWindowsAssetsImported } from './importNotify'
import { toCanonicalFilePath } from '../utils/pathUtils'
import { resolveLibraryPath, removeItemPack } from './libraryBundle'

/**
 * File Watcher Service using Chokidar
 * Monitors watched folders for file changes and auto-syncs with database
 */
export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null
  private watchedPaths: Set<string> = new Set()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private isWatching = false

  async watch(path: string): Promise<void> {
    if (this.watchedPaths.has(path)) return

    this.watchedPaths.add(path)
    console.log(`[FileWatcher] Watching: ${path}`)

    if (!this.isWatching) {
      this.startWatcher()
    }

    if (this.watcher) {
      this.watcher.add(path)
    }
  }

  unwatch(path: string): void {
    this.watchedPaths.delete(path)
    if (this.watcher) {
      this.watcher.unwatch(path)
    }
    if (this.watchedPaths.size === 0) {
      this.stop()
    }
  }

  private startWatcher(): void {
    if (this.isWatching) return

    const watchOptions: chokidar.WatchOptions = {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/thumbnails/**',
        '**/.*',
        '**/Thumbs.db',
        '**/*.db',
        '**/*.db-journal'
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      },
      usePolling: false
    }

    this.watcher = chokidar.watch(Array.from(this.watchedPaths), watchOptions)

    this.watcher.on('add', (filePath) => this.handleFileAdd(filePath))
    this.watcher.on('change', (filePath) => this.handleFileChange(filePath))
    this.watcher.on('unlink', (filePath) => this.handleFileDelete(filePath))

    this.watcher.on('ready', () => {
      console.log(`[FileWatcher] Ready - watching ${Array.from(this.watchedPaths).length} paths`)
    })

    this.watcher.on('error', (error) => {
      console.error('[FileWatcher] Error:', error.message)
    })

    this.isWatching = true
  }

  private handleFileAdd(filePath: string): void {
    this.debounce(`add:${filePath}`, async () => {
      try {
        if (!existsSync(filePath)) return

        const stat = statSync(filePath)
        if (!stat.isFile()) return

        const canonical = toCanonicalFilePath(filePath)
        const database = db!
        const rows = await database
          .select({ id: assets.id, filePath: assets.filePath, importSource: assets.importSource })
          .from(assets)
          .all()

        const existing = rows.find(
          (r) =>
            (r.importSource && r.importSource === canonical) ||
            resolveLibraryPath(r.filePath) === canonical
        )

        if (existing) {
          console.log(`[FileWatcher] File already exists in DB: ${basename(canonical)}`)
          return
        }

        console.log(`[FileWatcher] Auto-importing: ${basename(canonical)}`)
        await importSingleAsset(canonical)
        persistDatabase()
        notifyAllWindowsAssetsImported()
      } catch (error) {
        console.error(`[FileWatcher] Error handling add for ${filePath}:`, error)
      }
    }, 2000)
  }

  private handleFileChange(filePath: string): void {
    this.debounce(`change:${filePath}`, async () => {
      try {
        const database = db!
        const canonical = toCanonicalFilePath(filePath)

        const rows = await database
          .select({ id: assets.id, filePath: assets.filePath, importSource: assets.importSource })
          .from(assets)
          .all()
        const hit = rows.find(
          (r) =>
            (r.importSource && r.importSource === canonical) ||
            resolveLibraryPath(r.filePath) === canonical
        )

        if (hit && existsSync(canonical)) {
          const stat = statSync(canonical)
          await database
            .update(assets)
            .set({
              fileSize: stat.size,
              fileModifiedAt: stat.mtime,
              updatedAt: new Date()
            })
            .where(eq(assets.id, hit.id))
          persistDatabase()
        }
      } catch (error) {
        console.error(`[FileWatcher] Error handling change for ${filePath}:`, error)
      }
    }, 3000)
  }

  private handleFileDelete(filePath: string): void {
    this.debounce(`delete:${filePath}`, async () => {
      try {
        const database = db!
        const canonical = toCanonicalFilePath(filePath)

        const rows = await database
          .select({ id: assets.id, filePath: assets.filePath, importSource: assets.importSource })
          .from(assets)
          .all()
        const hit = rows.find(
          (r) =>
            (r.importSource && r.importSource === canonical) ||
            resolveLibraryPath(r.filePath) === canonical
        )

        if (hit) {
          removeItemPack(hit.id)
          await database.delete(assets).where(eq(assets.id, hit.id))
          console.log(`[FileWatcher] Removed deleted file from DB: ${basename(canonical)}`)
          persistDatabase()
        }
      } catch (error) {
        console.error(`[FileWatcher] Error handling delete for ${filePath}:`, error)
      }
    }, 1000)
  }

  private debounce(key: string, fn: () => Promise<void>, delayMs: number): void {
    const existing = this.debounceTimers.get(key)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(async () => {
      try {
        await fn()
      } finally {
        this.debounceTimers.delete(key)
      }
    }, delayMs)

    this.debounceTimers.set(key, timer)
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close().then(() => {
        console.log('[FileWatcher] Stopped')
      })
      this.watcher = null
    }
    this.isWatching = false
    this.debounceTimers.forEach((timer) => clearTimeout(timer))
    this.debounceTimers.clear()
  }

  getStatus(): { isWatching: boolean; watchedCount: number; paths: string[] } {
    return {
      isWatching: this.isWatching,
      watchedCount: this.watchedPaths.size,
      paths: Array.from(this.watchedPaths)
    }
  }
}

let instance: FileWatcher | null = null

export function getFileWatcher(): FileWatcher {
  if (!instance) {
    instance = new FileWatcher()
  }
  return instance
}
