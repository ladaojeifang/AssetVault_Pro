/**
 * Runs before `pnpm package`. Stops packaged/dev Electron instances and
 * removes release/win-unpacked so electron-builder can rewrite app.asar.
 */
import { execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const winUnpacked = join(root, 'release', 'win-unpacked')

function tryKillWindows() {
  if (process.platform !== 'win32') return
  const names = ['AssetVault Pro.exe', 'electron.exe']
  for (const name of names) {
    try {
      execSync(`taskkill /F /IM "${name}" /T`, { stdio: 'ignore', shell: true })
    } catch {
      /* not running */
    }
  }
}

function removeDir(path) {
  if (!existsSync(path)) return
  rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 })
}

tryKillWindows()
if (existsSync(winUnpacked)) {
  try {
    removeDir(winUnpacked)
    console.log('[prepackage] Removed release/win-unpacked')
  } catch (err) {
    console.error('[prepackage] Cannot delete release/win-unpacked:', err.message)
    console.error(
      '[prepackage] Close AssetVault Pro, dev Electron, and Explorer windows under release/, then run pnpm package again.'
    )
    process.exit(1)
  }
}
