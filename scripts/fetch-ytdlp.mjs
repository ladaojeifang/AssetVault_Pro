/**
 * Download latest official yt-dlp standalone binary into resources/bin/.
 * Runs on postinstall (and via `pnpm run fetch:ytdlp`).
 *
 * Skip: SKIP_YTDLP_FETCH=1
 */
import { chmodSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const binDir = join(root, 'resources', 'bin')

/** @type {Record<NodeJS.Platform, { filename: string; url: string } | undefined>} */
const PLATFORM = {
  win32: {
    filename: 'yt-dlp.exe',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
  },
  darwin: {
    filename: 'yt-dlp',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
  },
  linux: {
    filename: 'yt-dlp',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
  }
}

function probeVersion(exePath) {
  try {
    const r = spawnSync(exePath, ['--version'], {
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true
    })
    if (r.status !== 0) return null
    return (r.stdout || r.stderr || '').trim().split(/\r?\n/)[0] || null
  } catch {
    return null
  }
}

export async function fetchYtdlpBinary(options = {}) {
  const { force = true } = options

  if (process.env.SKIP_YTDLP_FETCH === '1') {
    console.log('[fetch-ytdlp] SKIP_YTDLP_FETCH=1 — skipped')
    return { ok: true, skipped: true }
  }

  const cfg = PLATFORM[process.platform]
  if (!cfg) {
    console.warn(`[fetch-ytdlp] Unsupported platform: ${process.platform} — skipped`)
    return { ok: true, skipped: true }
  }

  const target = join(binDir, cfg.filename)
  if (!force && probeVersion(target)) {
    console.log(`[fetch-ytdlp] Already present: ${target}`)
    return { ok: true, path: target, skipped: true }
  }

  mkdirSync(binDir, { recursive: true })
  const tmp = `${target}.download`

  console.log(`[fetch-ytdlp] Downloading ${cfg.url}`)
  try {
    const res = await fetch(cfg.url, { redirect: 'follow' })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1024) {
      throw new Error(`download too small (${buf.length} bytes)`)
    }
    writeFileSync(tmp, buf)
    try {
      unlinkSync(target)
    } catch {
      /* first install */
    }
    renameSync(tmp, target)
    if (process.platform !== 'win32') {
      try {
        chmodSync(target, 0o755)
      } catch {
        /* ignore */
      }
    }
    const version = probeVersion(target)
    console.log(`[fetch-ytdlp] Saved ${target}${version ? ` (${version})` : ''}`)
    return { ok: true, path: target, version }
  } catch (err) {
    try {
      unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[fetch-ytdlp] Failed: ${msg}`)
    if (probeVersion(target)) {
      console.warn(`[fetch-ytdlp] Keeping existing binary at ${target}`)
      return { ok: true, path: target, warning: msg }
    }
    return { ok: false, error: msg }
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const r = await fetchYtdlpBinary({ force: true })
  process.exit(r.ok ? 0 : 1)
}
