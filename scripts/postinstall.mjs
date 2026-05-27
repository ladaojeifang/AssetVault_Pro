/**
 * postinstall: try to install better-sqlite3 for Electron (prebuild or rebuild).
 * On failure, warn — dev must run `pnpm run rebuild:native` after installing VS C++ tools.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const script = join(dirname(fileURLToPath(import.meta.url)), 'rebuild-native.mjs')
const r = spawnSync(process.execPath, [script], { stdio: 'inherit', cwd: process.cwd() })

if (r.status !== 0) {
  console.warn(
    '\n[postinstall] better-sqlite3 is not ready for Electron yet.\n' +
      '  After installing VS Build Tools (C++), run: pnpm run rebuild:native\n'
  )
}

process.exit(0)
