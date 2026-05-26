/**
 * Rebuild native modules for Electron. Rebuilds better-sqlite3 only via @electron/rebuild
 * (not electron-builder install-app-deps) so stale pnpm .pnpm/node_modules junctions
 * do not break install/package.
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

function betterSqlite3Root() {
  try {
    return dirname(require.resolve('better-sqlite3/package.json'))
  } catch {
    return null
  }
}

function hasNativeBinary(root) {
  const rel = [
    join('build', 'Release', 'better_sqlite3.node'),
    join('prebuilds', `${process.platform}-${process.arch}`, 'better_sqlite3.node')
  ]
  return rel.some((p) => existsSync(join(root, p)))
}

async function rebuildBetterSqlite3() {
  const electronVersion = require('electron/package.json').version
  const rebuildPkg = require.resolve('@electron/rebuild', {
    paths: [require.resolve('electron-builder')]
  })
  const { rebuild } = await import(pathToFileURL(rebuildPkg).href)
  await rebuild({
    buildPath: process.cwd(),
    electronVersion,
    onlyModules: ['better-sqlite3'],
    force: true
  })
}

const pkgRoot = betterSqlite3Root()

try {
  await rebuildBetterSqlite3()
  console.log('[postinstall] better-sqlite3 rebuilt for Electron')
  process.exit(0)
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  const hint =
    'Install "Desktop development with C++" (VS Build Tools), then run: pnpm run rebuild:native'
  if (pkgRoot && hasNativeBinary(pkgRoot)) {
    console.warn(`[postinstall] electron-rebuild failed: ${msg}\n${hint}`)
    process.exit(0)
  }
  console.warn(
    `[postinstall] Skipping Electron rebuild for better-sqlite3: ${msg}\n` +
      `${hint}\n` +
      'If pnpm install failed on @tweenjs or other ENOENT, run: pnpm run clean:install'
  )
  process.exit(0)
}
