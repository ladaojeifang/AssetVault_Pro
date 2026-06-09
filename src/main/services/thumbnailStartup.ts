import { getMainBrowserWindow } from './mainWindowRef'
import { getDatabase } from '../db'

type Database = NonNullable<ReturnType<typeof getDatabase>>

const deferredThumbnailTasks: Array<() => Promise<void>> = []

let startupThumbnailPhase = true

let postStartupWorkGate: Promise<void> = Promise.resolve()

/** Queue thumbnail work until startup backfill finishes; then run serially in background. */
export function deferThumbnailWork(task: () => Promise<void>): void {
  if (startupThumbnailPhase) {
    deferredThumbnailTasks.push(task)
    return
  }
  postStartupWorkGate = postStartupWorkGate.then(
    () => task(),
    () => task()
  )
}

/** True while startup backfill is running (skip on-demand async thumb IPC). */
export function isStartupThumbnailPhase(): boolean {
  return startupThumbnailPhase
}

export function markStartupThumbnailPhaseComplete(): void {
  startupThumbnailPhase = false
}

export async function runDeferredThumbnailWork(): Promise<void> {
  const tasks = deferredThumbnailTasks.splice(0)
  for (const task of tasks) {
    try {
      await task()
    } catch (error) {
      console.warn('[ThumbnailStartup] deferred task failed:', error)
    }
  }
}

export async function waitForMainWindowIdle(
  maxMs = 60_000,
  settleMs = 2_000
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const win = getMainBrowserWindow()
    if (win && !win.isDestroyed() && win.isVisible() && !win.webContents.isLoading()) {
      await new Promise((r) => setTimeout(r, settleMs))
      return
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  console.warn('[ThumbnailStartup] main window idle wait timed out; continuing anyway')
}

export async function runStartupThumbnailBackfill(
  database: Database,
  jobs: Array<(db: Database) => Promise<void>>
): Promise<void> {
  for (const job of jobs) {
    try {
      await job(database)
    } catch (error) {
      console.warn('[ThumbnailStartup] backfill step failed:', error)
    }
  }
}
