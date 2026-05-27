/**
 * Install better-sqlite3 native binding for the project's Electron version.
 * 1) Try prebuild download (no compiler)
 * 2) Fall back to @electron/rebuild (requires VS C++ Build Tools on Windows)
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const cwd = process.cwd()

function betterSqlite3Root() {
  return dirname(require.resolve('better-sqlite3/package.json'))
}

function electronModulesAbi() {
  const electronVersion = require('electron/package.json').version
  try {
    const nodeAbi = require('node-abi')
    return String(nodeAbi.getAbi(electronVersion, 'electron'))
  } catch {
    // Electron 28.x → NODE_MODULE_VERSION 119
    const { execFileSync } = require('node:child_process')
    const electronBin = require('electron')
    return execFileSync(electronBin, ['-p', 'process.versions.modules'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15_000
    }).trim()
  }
}

function electronBindingPath(root, abi) {
  return join(
    root,
    'lib',
    'binding',
    `node-v${abi}-${process.platform}-${process.arch}`,
    'better_sqlite3.node'
  )
}

function hasElectronBinding(root) {
  try {
    const abi = electronModulesAbi()
    const path = electronBindingPath(root, abi)
    if (existsSync(path)) {
      console.log(`[rebuild-native] OK: ${path}`)
      return true
    }
    console.log(`[rebuild-native] Missing: ${path}`)
    return false
  } catch (e) {
    console.warn('[rebuild-native] Could not probe Electron ABI:', e)
    return false
  }
}

function tryPrebuildInstall(root) {
  const electronVersion = require('electron/package.json').version
  const prebuildBin = require.resolve('prebuild-install/bin')
  console.log(`[rebuild-native] Trying prebuild-install for Electron ${electronVersion}...`)
  const r = spawnSync(
    process.execPath,
    [
      prebuildBin,
      '--runtime',
      'electron',
      '--target',
      electronVersion,
      '--arch',
      process.arch,
      '--platform',
      process.platform
    ],
    { cwd: root, stdio: 'inherit', env: process.env }
  )
  return r.status === 0
}

async function tryElectronRebuild() {
  const electronVersion = require('electron/package.json').version
  const rebuildPkg = require.resolve('@electron/rebuild', {
    paths: [require.resolve('electron-builder')]
  })
  const { rebuild } = await import(pathToFileURL(rebuildPkg).href)
  console.log('[rebuild-native] Running @electron/rebuild for better-sqlite3...')
  await rebuild({
    buildPath: cwd,
    electronVersion,
    onlyModules: ['better-sqlite3'],
    force: true
  })
}

const root = betterSqlite3Root()

if (hasElectronBinding(root)) {
  process.exit(0)
}

if (tryPrebuildInstall(root) && hasElectronBinding(root)) {
  process.exit(0)
}

try {
  await tryElectronRebuild()
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`\n[rebuild-native] electron-rebuild failed:\n${msg}\n`)
  console.error(
    'Windows: install Visual Studio Build Tools 2022 with workload\n' +
      '  "Desktop development with C++", then run: pnpm run rebuild:native\n'
  )
  process.exit(1)
}

if (!hasElectronBinding(root)) {
  console.error('[rebuild-native] Rebuild finished but binding file is still missing.')
  process.exit(1)
}

console.log('[rebuild-native] better-sqlite3 is ready for Electron.')
