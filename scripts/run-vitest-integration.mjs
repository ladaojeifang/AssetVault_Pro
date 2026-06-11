#!/usr/bin/env node
/**
 * Run integration tests under Electron's Node (ABI 119) so better-sqlite3 matches resources/better_sqlite3.node.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const electronBin = require('electron')
const vitestCli = require.resolve('vitest/vitest.mjs')

const extraArgs = process.argv.slice(2)
const vitestArgs = ['run', '--config', 'vitest.integration.config.ts', ...extraArgs]

const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
delete env.AV_TEST_SKIP_CUSTOM_SQLITE

const r = spawnSync(electronBin, [vitestCli, ...vitestArgs], {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: true
})

process.exit(r.status === null ? 1 : r.status)
