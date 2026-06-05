import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { join, resolve } from 'path'
import { app } from 'electron'

export function buildYtdlpTempRoot(): string {
  return join(app.getPath('userData'), 'AssetVault', 'temp', 'ytdlp')
}

export function createJobTempDir(jobId: string): string {
  const dir = join(buildYtdlpTempRoot(), jobId)
  mkdirSync(dir, { recursive: true })
  return resolve(dir)
}

export function removeJobTempDir(jobId: string): boolean {
  const dir = join(buildYtdlpTempRoot(), jobId)
  if (!existsSync(dir)) return false
  try {
    rmSync(dir, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

/** Remove orphan job dirs (no active in-memory job). */
export function purgeOrphanYtdlpTempDirs(activeJobIds: Set<string>): number {
  const root = buildYtdlpTempRoot()
  if (!existsSync(root)) return 0
  let removed = 0
  for (const name of readdirSync(root)) {
    if (activeJobIds.has(name)) continue
    const dir = join(root, name)
    try {
      rmSync(dir, { recursive: true, force: true })
      removed++
    } catch {
      /* ignore */
    }
  }
  return removed
}
