import Database from 'better-sqlite3'
import type { SqliteDatabase } from './sqliteTypes'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)

let cachedNativeBinding: string | undefined | null = null

export type BetterSqliteOpenOptions = {
  nativeBinding?: string
}

/** Relative path under the better-sqlite3 package root (Electron 28 ≈ ABI 119). */
export function getExpectedElectronBindingRelPath(): string {
  try {
    const nodeAbi = require('node-abi')
    const electronVersion = require('electron/package.json').version
    const abi = nodeAbi.getAbi(electronVersion, 'electron')
    return join('lib', 'binding', `node-v${abi}-${process.platform}-${process.arch}`, 'better_sqlite3.node')
  } catch {
    return join('lib', 'binding', `node-v119-${process.platform}-${process.arch}`, 'better_sqlite3.node')
  }
}

export function getExpectedElectronBindingAbsPath(): string | null {
  try {
    const root = dirname(require.resolve('better-sqlite3/package.json'))
    return join(root, getExpectedElectronBindingRelPath())
  } catch {
    return null
  }
}

function collectProjectRoots(): string[] {
  const roots = new Set<string>()
  roots.add(process.cwd())

  try {
    const { app } = require('electron') as typeof import('electron')
    if (app?.getAppPath) {
      roots.add(app.getAppPath())
      // Dev: app path may be .../out/main — project root is two levels up
      roots.add(join(app.getAppPath(), '..', '..'))
      roots.add(join(app.getAppPath(), '..'))
    }
    if (process.resourcesPath) {
      roots.add(process.resourcesPath)
    }
  } catch {
    /* not in Electron */
  }

  try {
    const mainDir = dirname(fileURLToPath(import.meta.url))
    roots.add(mainDir)
    roots.add(join(mainDir, '..'))
    roots.add(join(mainDir, '..', '..'))
  } catch {
    /* bundled without import.meta.url */
  }

  return [...roots]
}

/** Optional prebuilt binary outside node_modules (env or resources/). */
export function resolveBetterSqliteNativeBinding(): string | undefined {
  if (process.env.AV_TEST_SKIP_CUSTOM_SQLITE === '1') {
    cachedNativeBinding = ''
    return undefined
  }

  if (cachedNativeBinding !== null) {
    return cachedNativeBinding || undefined
  }

  const env = process.env.BETTER_SQLITE3_BINDING?.trim()
  if (env && existsSync(env)) {
    cachedNativeBinding = env
    return env
  }

  const relPaths = [
    join('resources', 'native', 'better_sqlite3.node'),
    join('resources', 'better_sqlite3.node'),
    'better_sqlite3.node'
  ]

  for (const root of collectProjectRoots()) {
    for (const rel of relPaths) {
      const full = join(root, rel)
      if (existsSync(full)) {
        cachedNativeBinding = full
        return full
      }
    }
  }

  cachedNativeBinding = ''
  return undefined
}

export function getBetterSqliteConstructorOptions(): BetterSqliteOpenOptions {
  const nativeBinding = resolveBetterSqliteNativeBinding()
  if (nativeBinding) {
    console.log('[DB] Using custom better_sqlite3.node:', nativeBinding)
    return { nativeBinding }
  }
  return {}
}

export function formatBetterSqliteSetupHint(): string {
  const expected = getExpectedElectronBindingAbsPath()
  const custom = join(process.cwd(), 'resources', 'better_sqlite3.node')
  return (
    '预编译 better_sqlite3.node 须满足：\n' +
    '  • 文件名是 better_sqlite3.node（下划线，不是连字符）\n' +
    '  • 针对 Electron 28 / NODE_MODULE_VERSION 119 / win32-x64（不是本机 Node 22）\n' +
    '  • 与 better-sqlite3@11.x 匹配\n\n' +
    '可放在（任选其一，推荐 1）：\n' +
    `  1) ${custom}\n` +
    `  2) ${expected ?? 'node_modules/better-sqlite3/lib/binding/node-v119-win32-x64/better_sqlite3.node'}\n` +
    '  3) 环境变量 BETTER_SQLITE3_BINDING=绝对路径\n\n' +
    '或在本机编译：pnpm run rebuild:native（需 VS C++ 工作负载）'
  )
}

export const BETTER_SQLITE_REBUILD_HINT = formatBetterSqliteSetupHint()

/** True when better-sqlite3 was not compiled for the current runtime (Electron vs Node). */
export function isBetterSqliteBindingsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message
  if (msg.includes('Could not locate the bindings file')) return true
  if (msg.includes('NODE_MODULE_VERSION')) return true
  if (msg.includes('was compiled against a different Node.js version')) return true
  const tries = (err as Error & { tries?: unknown }).tries
  return Array.isArray(tries)
}

function openProbeDatabase(): SqliteDatabase {
  const opts = getBetterSqliteConstructorOptions()
  return Object.keys(opts).length > 0 ? new Database(':memory:', opts) : new Database(':memory:')
}

/** Probe in-memory open; throws with bindings error if .node is missing/wrong ABI. */
export function probeBetterSqliteNative(): void {
  const db = openProbeDatabase()
  db.close()
}

export function openBetterSqliteDatabase(
  filename: string,
  options?: ConstructorParameters<typeof Database>[1]
): SqliteDatabase {
  const native = getBetterSqliteConstructorOptions()
  return new Database(filename, { ...native, ...options })
}
