import { spawn } from 'child_process'
import { extname } from 'path'
import ffmpegStatic from 'ffmpeg-static'

const EXTRACT_TIMEOUT_MS = 45_000

function resolveFfmpegBinary(): string | null {
  const bundled = ffmpegStatic && ffmpegStatic.length > 0 ? ffmpegStatic : null
  if (bundled) return bundled
  const fromEnv = process.env.FFMPEG_PATH
  return fromEnv && fromEnv.length > 0 ? fromEnv : null
}

/**
 * Decode one video frame as PNG bytes via ffmpeg (stdout pipe).
 * Used for grid thumbnails; requires `ffmpeg-static` or `FFMPEG_PATH`.
 */
export function extractVideoFramePng(filePath: string, timeSec: number): Promise<Buffer | null> {
  const ffmpeg = resolveFfmpegBinary()
  if (!ffmpeg) {
    console.warn('[VideoFrame] No ffmpeg binary: install dependency ffmpeg-static or set FFMPEG_PATH')
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    const stderr: string[] = []

    const proc = spawn(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-ss',
        String(Math.max(0, timeSec)),
        '-i',
        filePath,
        '-map',
        '0:v:0?',
        '-frames:v',
        '1',
        '-an',
        '-f',
        'image2pipe',
        '-vcodec',
        'png',
        '-'
      ],
      { windowsHide: true }
    )

    const killTimer = setTimeout(() => {
      proc.kill('SIGKILL')
    }, EXTRACT_TIMEOUT_MS)

    proc.stdout.on('data', (c: Buffer) => chunks.push(c))
    proc.stderr.on('data', (c: Buffer) => stderr.push(c.toString()))

    proc.on('error', (err) => {
      clearTimeout(killTimer)
      console.error('[VideoFrame] ffmpeg spawn error:', err)
      resolve(null)
    })

    proc.on('close', (code) => {
      clearTimeout(killTimer)
      const errText = stderr.join('').trim()
      if (code !== 0) {
        if (errText) console.error('[VideoFrame] ffmpeg failed:', errText)
        resolve(null)
        return
      }
      const buf = Buffer.concat(chunks)
      if (buf.length < 32) {
        resolve(null)
        return
      }
      resolve(buf)
    })
  })
}

/** Try mid-roll then first frame (short clips / keyframe issues). */
export async function extractVideoFramePngBestEffort(filePath: string): Promise<Buffer | null> {
  let png = await extractVideoFramePng(filePath, 0.5)
  if (!png) png = await extractVideoFramePng(filePath, 0)
  return png
}

export function isGifFilePath(filePath: string): boolean {
  return extname(filePath).toLowerCase() === '.gif'
}

/** GIF decode via ffmpeg — @napi-rs/image does not support GIF. */
export function extractGifFramePngBestEffort(filePath: string): Promise<Buffer | null> {
  return extractVideoFramePng(filePath, 0).then((png) => png ?? extractVideoFramePng(filePath, 0.1))
}
