import { chmodSync, existsSync, mkdirSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { spawnSync } from 'child_process'
import { app } from 'electron'
import ffmpegStatic from 'ffmpeg-static'

let cachedExecutable: string | null | undefined
let cachedVersion: string | null | undefined
let ensurePromise: Promise<string | null> | null = null

const YTDLP_BIN_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'

const PATH_CANDIDATES =
  process.platform === 'win32'
    ? ['yt-dlp.exe', 'yt-dlp', 'youtube-dl.exe', 'youtube-dl']
    : ['yt-dlp', 'youtube-dl']

/** Official standalone builds (no Python): https://github.com/yt-dlp/yt-dlp#release-files */
const RELEASE_DOWNLOAD_URL =
  process.platform === 'win32'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : process.platform === 'darwin'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'

export function getManagedYtdlpDir(): string {
  return join(app.getPath('userData'), 'AssetVault', 'bin')
}

export function getManagedYtdlpPath(): string {
  return join(getManagedYtdlpDir(), YTDLP_BIN_NAME)
}

/** Path under extraResources after pack: `{resourcesPath}/bin/yt-dlp(.exe)`. */
export function getBundledYtdlpRelPath(): string {
  return join('bin', YTDLP_BIN_NAME)
}

function collectBundledYtdlpSearchRoots(): string[] {
  const roots = new Set<string>()
  if (process.resourcesPath) roots.add(process.resourcesPath)
  roots.add(process.cwd())
  try {
    const appPath = app.getAppPath()
    if (appPath) {
      roots.add(appPath)
      roots.add(join(appPath, '..'))
      roots.add(join(appPath, '..', '..'))
    }
  } catch {
    /* pre-ready */
  }
  return [...roots]
}

/**
 * Installer-bundled or dev repo copy: `resources/bin/yt-dlp.exe` → pack后 `resources/bin/yt-dlp.exe`.
 */
export function resolveBundledYtdlpPath(): string | null {
  const rel = getBundledYtdlpRelPath()
  for (const root of collectBundledYtdlpSearchRoots()) {
    const packaged = join(root, rel)
    if (existsSync(packaged)) return packaged
    const devRepo = join(root, 'resources', rel)
    if (existsSync(devRepo)) return devRepo
  }
  return null
}

function envYtdlpPath(): string | null {
  const raw = process.env.ASSETVAULT_YTDLP_PATH ?? process.env.YTDLP_PATH
  if (!raw?.trim()) return null
  const p = raw.trim()
  return existsSync(p) ? p : null
}

function windowsPipYtdlpPaths(): string[] {
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return []
  const root = join(localAppData, 'Programs', 'Python')
  const out: string[] = []
  try {
    for (const name of readdirSync(root)) {
      const exe = join(root, name, 'Scripts', 'yt-dlp.exe')
      if (existsSync(exe)) out.push(exe)
    }
  } catch {
    /* ignore */
  }
  return out
}

function tryExecutable(cmd: string): boolean {
  try {
    const r = spawnSync(cmd, ['--version'], {
      encoding: 'utf8',
      timeout: 8000,
      windowsHide: true
    })
    if (r.status === 0) {
      cachedExecutable = cmd
      const line = (r.stdout || r.stderr || '').trim().split(/\r?\n/)[0] || ''
      cachedVersion = line || null
      return true
    }
  } catch {
    /* try next */
  }
  return false
}

function orderedCandidates(): string[] {
  const list: string[] = []
  const env = envYtdlpPath()
  if (env) list.push(env)
  const bundled = resolveBundledYtdlpPath()
  if (bundled) list.push(bundled)
  const managed = getManagedYtdlpPath()
  if (existsSync(managed)) list.push(managed)
  list.push(...windowsPipYtdlpPaths(), ...PATH_CANDIDATES)
  return list
}

export function resetYtdlpCache(): void {
  cachedExecutable = undefined
  cachedVersion = undefined
}

/**
 * Resolve yt-dlp executable.
 * Order: env → installer `resources/bin` → userData download → pip/PATH.
 */
export function resolveYtdlpExecutable(): string | null {
  if (cachedExecutable !== undefined) return cachedExecutable
  for (const cmd of orderedCandidates()) {
    if (tryExecutable(cmd)) return cmd
  }
  cachedExecutable = null
  cachedVersion = null
  return null
}

/**
 * Ensure yt-dlp is available. Uses bundled binary when present; otherwise downloads to userData.
 */
export async function ensureManagedYtdlpBinary(): Promise<string | null> {
  const bundled = resolveBundledYtdlpPath()
  if (bundled && tryExecutable(bundled)) return bundled

  const target = getManagedYtdlpPath()
  if (existsSync(target) && tryExecutable(target)) return target

  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    mkdirSync(dirname(target), { recursive: true })
    const tmp = `${target}.download`
    try {
      const res = await fetch(RELEASE_DOWNLOAD_URL, { redirect: 'follow' })
      if (!res.ok) {
        console.warn('[PageVideoImport] yt-dlp download failed:', res.status, res.statusText)
        return null
      }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 1024) {
        console.warn('[PageVideoImport] yt-dlp download too small, aborted')
        return null
      }
      writeFileSync(tmp, buf)
      renameSync(tmp, target)
      if (process.platform !== 'win32') {
        try {
          chmodSync(target, 0o755)
        } catch {
          /* ignore */
        }
      }
      resetYtdlpCache()
      return resolveYtdlpExecutable()
    } catch (e) {
      console.warn('[PageVideoImport] yt-dlp download error:', e)
      try {
        if (existsSync(tmp)) unlinkSync(tmp)
      } catch {
        /* ignore */
      }
      return null
    } finally {
      ensurePromise = null
    }
  })()

  return ensurePromise
}

export function getYtdlpVersion(): string | null {
  resolveYtdlpExecutable()
  return cachedVersion ?? null
}

export function getFfmpegExecutablePath(): string | null {
  const bundled = ffmpegStatic && ffmpegStatic.length > 0 ? ffmpegStatic : null
  if (bundled && existsSync(bundled)) return bundled
  const fromEnv = process.env.FFMPEG_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  return null
}

export function isFfmpegPresent(): boolean {
  return Boolean(getFfmpegExecutablePath())
}

function findExecutableInPath(names: string[]): string | null {
  const lookup = process.platform === 'win32' ? 'where' : 'which'
  for (const name of names) {
    try {
      const r = spawnSync(lookup, [name], {
        encoding: 'utf8',
        timeout: 3000,
        windowsHide: true
      })
      if (r.status !== 0) continue
      const line = (r.stdout || '').trim().split(/\r?\n/)[0]?.trim()
      if (line && existsSync(line)) return line
    } catch {
      /* try next */
    }
  }
  return null
}

/** yt-dlp YouTube EJS: prefer Deno (default) or Node when on PATH. */
export function resolveYtdlpJsRuntimeArgs(): string[] {
  const deno = findExecutableInPath(process.platform === 'win32' ? ['deno.exe', 'deno'] : ['deno'])
  if (deno) return ['--js-runtimes', `deno:${deno}`]
  const node = findExecutableInPath(process.platform === 'win32' ? ['node.exe', 'node'] : ['node'])
  if (node) return ['--js-runtimes', `node:${node}`]
  return []
}

export function probeYtdlpOnStartup(): void {
  const exe = resolveYtdlpExecutable()
  if (exe) {
    console.log(`[PageVideoImport] yt-dlp: ${exe} (${getYtdlpVersion() ?? 'unknown'})`)
    return
  }
  console.log('[PageVideoImport] yt-dlp not found; will try downloading standalone binary…')
  void ensureManagedYtdlpBinary().then((p) => {
    if (p) {
      console.log(`[PageVideoImport] yt-dlp ready: ${p} (${getYtdlpVersion() ?? 'unknown'})`)
    } else {
      console.warn('[PageVideoImport] yt-dlp unavailable — page video import disabled until binary is present')
    }
  })
}
