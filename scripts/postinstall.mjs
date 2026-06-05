/**
 * postinstall: fetch latest yt-dlp into resources/bin, then rebuild better-sqlite3 for Electron.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fetchYtdlpBinary } from './fetch-ytdlp.mjs'

const scriptsDir = dirname(fileURLToPath(import.meta.url))

const ytdlp = await fetchYtdlpBinary({ force: true })
if (!ytdlp.ok && !ytdlp.skipped) {
  console.warn(
    '\n[postinstall] yt-dlp download failed (page video import needs resources/bin or network).\n' +
      '  Retry: pnpm run fetch:ytdlp\n'
  )
}

const rebuildScript = join(scriptsDir, 'rebuild-native.mjs')
const r = spawnSync(process.execPath, [rebuildScript], { stdio: 'inherit', cwd: process.cwd() })

if (r.status !== 0) {
  console.warn(
    '\n[postinstall] better-sqlite3 is not ready for Electron yet.\n' +
      '  After installing VS Build Tools (C++), run: pnpm run rebuild:native\n'
  )
}

process.exit(0)
