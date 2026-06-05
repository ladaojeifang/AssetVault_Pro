import { spawn, type ChildProcess } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, extname } from 'path'
import {
  getFfmpegExecutablePath,
  resolveYtdlpExecutable,
  resolveYtdlpJsRuntimeArgs
} from './ytdlpBinary'
import { classifyStderr, parseProgress, stderrTailLines } from './ytdlpStderr'

const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.m4v', '.flv'])

export type YtdlpRunOptions = {
  url: string
  tempDir: string
  format: string
  platform?: string | null
  referer: string
  cookiesFromBrowser: 'edge' | 'chrome' | 'firefox' | 'none'
  cookiesFile?: string | null
  cookieHeader?: string | null
  noPlaylist: boolean
  writeSubs?: boolean
  subtitleLangs?: string[] | null
  jobTimeoutMs: number
  stallTimeoutMs: number
  isCancelled: () => boolean
  onStage: (stage: 'extracting' | 'downloading' | 'postprocessing') => void
  onProgress: (percent: number | null) => void
  onMeta: (meta: { title?: string; durationSec?: number; extractor?: string }) => void
}

export type YtdlpRunResult = {
  videoPath: string
  info?: Record<string, unknown>
}

export type YtdlpDownloadHandle = {
  promise: Promise<YtdlpRunResult>
  cancel: () => void
}

function parseStageLine(line: string): 'downloading' | 'postprocessing' | null {
  if (/\[download\]/i.test(line)) return 'downloading'
  if (/\[Merger\]|\[ExtractAudio\]|post-?process|ffmpeg/i.test(line)) return 'postprocessing'
  return null
}

function findLargestVideoFile(tempDir: string): string | null {
  let best: { path: string; size: number } | null = null
  for (const name of readdirSync(tempDir)) {
    if (name.endsWith('.part') || name.endsWith('.ytdl') || name.endsWith('.info.json')) continue
    const ext = extname(name).toLowerCase()
    if (!VIDEO_EXTS.has(ext)) continue
    const full = join(tempDir, name)
    try {
      const st = statSync(full)
      if (!st.isFile()) continue
      if (!best || st.size > best.size) best = { path: full, size: st.size }
    } catch {
      /* skip */
    }
  }
  return best?.path ?? null
}

function readInfoJson(tempDir: string): Record<string, unknown> | undefined {
  for (const name of readdirSync(tempDir)) {
    if (!name.endsWith('.info.json')) continue
    try {
      return JSON.parse(readFileSync(join(tempDir, name), 'utf8')) as Record<string, unknown>
    } catch {
      /* skip */
    }
  }
  return undefined
}

function killChildProcess(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!child.pid || child.killed) {
      resolve()
      return
    }
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    child.once('exit', done)
    child.once('error', done)
    const forceTimer = setTimeout(done, 10_000)

    try {
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          windowsHide: true
        })
        killer.on('error', done)
        killer.on('close', () => {
          /* child exit handler completes */
        })
      } else {
        child.kill('SIGTERM')
        setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch {
            /* ignore */
          }
        }, 2000)
      }
    } catch {
      try {
        child.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      done()
    }

    child.once('exit', () => clearTimeout(forceTimer))
  })
}

export function runYtdlpDownload(opts: YtdlpRunOptions): YtdlpDownloadHandle {
  const exe = resolveYtdlpExecutable()
  if (!exe) throw new Error('YTDLP_NOT_INSTALLED')

  const args = ['--no-warnings', '--no-mtime', ...resolveYtdlpJsRuntimeArgs()]
  const platform = opts.platform?.trim().toLowerCase()
  if (platform === 'youtube') {
    args.push('--extractor-args', 'youtube:player_client=android,android_vr,web')
  }
  if (opts.noPlaylist) args.push('--no-playlist')
  if (opts.writeSubs) {
    args.push('--write-subs')
    if (opts.subtitleLangs?.length) {
      args.push('--sub-langs', opts.subtitleLangs.join(','))
    }
  }
  if (opts.cookiesFile) {
    args.push('--cookies', opts.cookiesFile)
  } else if (opts.cookieHeader?.trim()) {
    args.push('--add-header', `Cookie: ${opts.cookieHeader.trim()}`)
  } else if (opts.cookiesFromBrowser !== 'none') {
    args.push('--cookies-from-browser', opts.cookiesFromBrowser)
  }
  const ffmpeg = getFfmpegExecutablePath()
  if (ffmpeg) {
    args.push('--ffmpeg-location', ffmpeg)
  }
  args.push(
    '--referer',
    opts.referer,
    '-f',
    opts.format,
    '--replace-in-metadata',
    'title',
    String.raw`[\\/:*?"<>|]`,
    '_',
    '--merge-output-format',
    'mp4',
    '--write-thumbnail',
    '--write-info-json',
    '--paths',
    opts.tempDir,
    '-o',
    '%(title).200B.%(ext)s',
    opts.url
  )

  let child: ChildProcess | null = null
  let killInFlight: Promise<void> | null = null

  const promise = new Promise<YtdlpRunResult>((resolve, reject) => {
    let settled = false
    let stderrBuf = ''
    let lastProgressAt = Date.now()
    let stage: 'extracting' | 'downloading' | 'postprocessing' = 'extracting'
    opts.onStage(stage)

    const jobTimer = setTimeout(() => {
      void terminate('YTDLP_JOB_TIMEOUT')
    }, opts.jobTimeoutMs)

    const stallTimer = setInterval(() => {
      if (opts.isCancelled()) {
        void terminate('JOB_CANCELLED')
        return
      }
      if (Date.now() - lastProgressAt > opts.stallTimeoutMs) {
        void terminate('YTDLP_STALLED')
      }
    }, 30_000)

    async function terminate(code: string): Promise<void> {
      await killChild()
      finishErr(code)
    }

    async function killChild(): Promise<void> {
      if (!child) return
      if (!killInFlight) {
        killInFlight = killChildProcess(child)
      }
      await killInFlight
    }

    function finishOk(): void {
      if (settled) return
      settled = true
      clearTimeout(jobTimer)
      clearInterval(stallTimer)
      const videoPath = findLargestVideoFile(opts.tempDir)
      if (!videoPath || !existsSync(videoPath)) {
        reject(new Error('YTDLP_DOWNLOAD_FAILED'))
        return
      }
      const info = readInfoJson(opts.tempDir)
      if (info) {
        const title = typeof info.title === 'string' ? info.title : undefined
        const duration =
          typeof info.duration === 'number'
            ? info.duration
            : typeof info.duration === 'string'
              ? Number(info.duration)
              : undefined
        const extractor =
          typeof info.extractor === 'string'
            ? info.extractor
            : typeof info.extractor_key === 'string'
              ? info.extractor_key
              : undefined
        opts.onMeta({
          title,
          durationSec: Number.isFinite(duration) ? duration : undefined,
          extractor
        })
      }
      resolve({ videoPath, info })
    }

    function finishErr(code: string, detail?: string): void {
      if (settled) return
      settled = true
      clearTimeout(jobTimer)
      clearInterval(stallTimer)
      const err = new Error(code) as Error & { detail?: string }
      if (detail) err.detail = detail.slice(0, 2000)
      reject(err)
    }

    child = spawn(exe, args, {
      cwd: opts.tempDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const onLine = (line: string) => {
      if (opts.isCancelled()) {
        void terminate('JOB_CANCELLED')
        return
      }
      const st = parseStageLine(line)
      if (st) {
        stage = st
        opts.onStage(st)
        lastProgressAt = Date.now()
      }
      const pct = parseProgress(line)
      if (pct !== null) {
        stage = 'downloading'
        opts.onStage('downloading')
        opts.onProgress(pct)
        lastProgressAt = Date.now()
      }
    }

    const proc = child
    proc.stdout?.on('data', (buf: Buffer) => {
      for (const line of buf.toString('utf8').split(/\r?\n/)) {
        if (line.trim()) onLine(line)
      }
    })
    proc.stderr?.on('data', (buf: Buffer) => {
      const chunk = buf.toString('utf8')
      stderrBuf += chunk
      if (stderrBuf.length > 32_000) stderrBuf = stderrBuf.slice(-32_000)
      for (const line of chunk.split(/\r?\n/)) {
        if (line.trim()) onLine(line)
      }
    })

    proc.on('error', () => finishErr('YTDLP_NOT_INSTALLED'))
    proc.on('close', (code) => {
      if (opts.isCancelled()) {
        reject(new Error('JOB_CANCELLED'))
        return
      }
      if (code === 0) {
        finishOk()
        return
      }
      finishErr(classifyStderr(stderrBuf), stderrTailLines(stderrBuf))
    })
  })

  return {
    promise,
    cancel: () => {
      if (child && !killInFlight) {
        killInFlight = killChildProcess(child)
      }
    }
  }
}
