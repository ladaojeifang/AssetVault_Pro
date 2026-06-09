import { spawn } from 'child_process'
import { basename, extname, join } from 'path'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { THUMBNAIL_PIPELINE } from '@/shared/thumbnailPipelineConfig'
import { resolveFfmpegBinary } from '../../utils/videoFrame'
import { readTextHead } from './renderTextPreviewBmp'
import { enqueueTextPreviewRender } from './textPreviewRenderQueue'

const RENDER_TIMEOUT_MS = THUMBNAIL_PIPELINE.svg.renderTimeoutMs

function pickBadge(ext: string): { label: string; color: string } {
  const e = ext.toLowerCase().replace(/^\./, '')
  if (e === 'json') return { label: 'JSON', color: '0xe3b505' }
  if (e === 'md') return { label: 'MD', color: '0x083fa1' }
  return { label: 'TXT', color: '0x666666' }
}

/** Font paths for ffmpeg drawtext only — never stat/open fonts in Electron main process. */
function ffmpegFontCandidates(): string[] {
  const fromEnv = process.env.ASSETVAULT_TEXT_FONT?.trim()
  if (fromEnv) return [fromEnv.replace(/\\/g, '/')]

  if (process.platform === 'win32') {
    return [
      'C:/Windows/Fonts/msyh.ttc',
      'C:/Windows/Fonts/simhei.ttf',
      'C:/Windows/Fonts/simsun.ttc'
    ]
  }
  if (process.platform === 'darwin') {
    return ['/System/Library/Fonts/PingFang.ttc', '/System/Library/Fonts/STHeiti Light.ttc']
  }
  return [
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
  ]
}

function ffmpegFilterPath(absPath: string): string {
  return absPath.replace(/\\/g, '/').replace(/:/g, '\\:')
}

function writeUtf8TextFile(path: string, text: string): void {
  writeFileSync(path, text.length > 0 ? text : ' ', 'utf8')
}

function buildDrawtextFilter(
  size: number,
  ext: string,
  filename: string,
  lines: string[],
  fontFile: string,
  tmpDir: string
): string {
  const badge = pickBadge(ext)
  const fontEsc = ffmpegFilterPath(fontFile)
  const margin = 36
  const paperX = margin
  const paperY = margin
  const paperW = size - margin * 2
  const paperH = size - margin * 2
  const textPadX = 18

  const parts: string[] = [
    `drawbox=x=${paperX + 4}:y=${paperY + 4}:w=${paperW}:h=${paperH}:color=black@0.12:t=fill`,
    `drawbox=x=${paperX}:y=${paperY}:w=${paperW}:h=${paperH}:color=white@1:t=fill`,
    `drawbox=x=${paperX + 12}:y=${paperY + 12}:w=52:h=22:color=${badge.color}@1:t=fill`,
    `drawtext=fontfile='${fontEsc}':text='${badge.label}':x=${paperX + 20}:y=${paperY + 28}:fontsize=11:fontcolor=white`
  ]

  let y = paperY + 56
  const lineHeight = 18
  const maxY = paperY + paperH - 24

  for (let i = 0; i < lines.length; i++) {
    if (y + lineHeight > maxY) break
    const linePath = join(tmpDir, `line-${i}.txt`)
    writeUtf8TextFile(linePath, lines[i]!)
    parts.push(
      `drawtext=fontfile='${fontEsc}':textfile='${ffmpegFilterPath(linePath)}':x=${paperX + textPadX}:y=${y}:fontsize=13:fontcolor=0x333333`
    )
    y += lineHeight
  }

  const footerPath = join(tmpDir, 'footer.txt')
  writeUtf8TextFile(footerPath, basename(filename))
  parts.push(
    `drawtext=fontfile='${fontEsc}':textfile='${ffmpegFilterPath(footerPath)}':x=${paperX + textPadX}:y=${paperY + paperH - 14}:fontsize=11:fontcolor=0x8c8c8c`
  )

  return parts.join(',')
}

/** Fallback filter when no system CJK font is available — no fontfile, ffmpeg uses its built-in default font. */
function buildDrawtextFilterNoFont(
  size: number,
  ext: string,
  filename: string,
  lines: string[],
  tmpDir: string
): string {
  const badge = pickBadge(ext)
  const margin = 36
  const paperX = margin
  const paperY = margin
  const paperW = size - margin * 2
  const paperH = size - margin * 2
  const textPadX = 18

  const parts: string[] = [
    `drawbox=x=${paperX + 4}:y=${paperY + 4}:w=${paperW}:h=${paperH}:color=black@0.12:t=fill`,
    `drawbox=x=${paperX}:y=${paperY}:w=${paperW}:h=${paperH}:color=white@1:t=fill`,
    `drawbox=x=${paperX + 12}:y=${paperY + 12}:w=52:h=22:color=${badge.color}@1:t=fill`,
    `drawtext=text='${badge.label}':x=${paperX + 20}:y=${paperY + 28}:fontsize=11:fontcolor=white`
  ]

  let y = paperY + 56
  const lineHeight = 18
  const maxY = paperY + paperH - 24

  for (let i = 0; i < lines.length; i++) {
    if (y + lineHeight > maxY) break
    const linePath = join(tmpDir, `nofont-line-${i}.txt`)
    writeUtf8TextFile(linePath, lines[i]!)
    parts.push(
      `drawtext=textfile='${ffmpegFilterPath(linePath)}':x=${paperX + textPadX}:y=${y}:fontsize=13:fontcolor=0x333333`
    )
    y += lineHeight
  }

  const footerPath = join(tmpDir, 'nofont-footer.txt')
  writeUtf8TextFile(footerPath, basename(filename))
  parts.push(
    `drawtext=textfile='${ffmpegFilterPath(footerPath)}':x=${paperX + textPadX}:y=${paperY + paperH - 14}:fontsize=11:fontcolor=0x8c8c8c`
  )

  return parts.join(',')
}

function runFfmpegToFile(outputPath: string, args: string[]): Promise<boolean> {
  const ffmpeg = resolveFfmpegBinary()
  if (!ffmpeg) {
    console.warn('[TextPreviewFfmpeg] No ffmpeg binary')
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    const stderr: string[] = []
    const proc = spawn(
      ffmpeg,
      ['-hide_banner', '-loglevel', 'error', '-nostdin', '-hwaccel', 'none', '-threads', '1', ...args, '-y', outputPath],
      { windowsHide: true }
    )

    const killTimer = setTimeout(() => proc.kill('SIGKILL'), RENDER_TIMEOUT_MS)

    proc.stderr.on('data', (c: Buffer) => stderr.push(c.toString()))

    proc.on('error', (err) => {
      clearTimeout(killTimer)
      console.warn('[TextPreviewFfmpeg] spawn error:', err.message)
      resolve(false)
    })

    proc.on('close', (code) => {
      clearTimeout(killTimer)
      if (code !== 0) {
        const errText = stderr.join('').trim()
        if (errText) console.warn('[TextPreviewFfmpeg] failed:', errText.slice(0, 300))
        resolve(false)
        return
      }
      resolve(existsSync(outputPath) && readFileSync(outputPath).length > 0)
    })
  })
}

async function lavfiFrameToWebp(
  filter: string,
  size: number,
  quality: number,
  tmpDir: string
): Promise<Buffer | null> {
  const q = Math.min(100, Math.max(10, Math.floor(quality)))
  const lavfiArgs = [
    '-f',
    'lavfi',
    '-i',
    `color=c=0xf5f5f5:s=${size}x${size}`,
    '-vf',
    filter,
    '-frames:v',
    '1'
  ]

  const outWebp = join(tmpDir, 'out.webp')
  if (await runFfmpegToFile(outWebp, [...lavfiArgs, '-f', 'webp', '-quality', String(q)])) {
    return readFileSync(outWebp)
  }

  const outPng = join(tmpDir, 'out.png')
  if (!(await runFfmpegToFile(outPng, [...lavfiArgs, '-f', 'image2', '-vcodec', 'png']))) {
    return null
  }

  const outWebp2 = join(tmpDir, 'out2.webp')
  if (await runFfmpegToFile(outWebp2, ['-i', outPng, '-frames:v', '1', '-f', 'webp', '-quality', String(q)])) {
    return readFileSync(outWebp2)
  }

  return null
}

async function renderTextPreviewWebpBufferInner(
  filePath: string,
  options?: { size?: number; quality?: number }
): Promise<Buffer | null> {
  const size = Math.min(512, Math.max(64, Math.floor(options?.size ?? 256)))
  const quality = options?.quality ?? THUMBNAIL_PIPELINE.output.defaultQuality
  const ext = extname(filePath).toLowerCase()

  let text: string
  try {
    text = readTextHead(filePath, THUMBNAIL_PIPELINE.textPreview.maxBytes)
  } catch (e) {
    console.warn('[TextPreviewFfmpeg] read failed:', filePath, e instanceof Error ? e.message : String(e))
    return null
  }

  const lines = text.split('\n').slice(0, THUMBNAIL_PIPELINE.textPreview.maxLines)
  const tmpDir = mkdtempSync(join(tmpdir(), 'av-text-thumb-'))

  try {
    for (const fontFile of ffmpegFontCandidates()) {
      const filter = buildDrawtextFilter(size, ext, filePath, lines, fontFile, tmpDir)
      const buf = await lavfiFrameToWebp(filter, size, quality, tmpDir)
      if (buf?.length) return buf
    }

    // Fallback: no system CJK font — try ffmpeg built-in default font
    const noFontFilter = buildDrawtextFilterNoFont(size, ext, filePath, lines, tmpDir)
    const noFontBuf = await lavfiFrameToWebp(noFontFilter, size, quality, tmpDir)
    if (noFontBuf?.length) return noFontBuf

    return null
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* best effort */
    }
  }
}

/** Paper-style text preview via ffmpeg subprocess (no main-process font access / Skia / GPU window). */
export async function renderTextPreviewWebpBuffer(
  filePath: string,
  options?: { size?: number; quality?: number }
): Promise<Buffer | null> {
  return enqueueTextPreviewRender(() => renderTextPreviewWebpBufferInner(filePath, options))
}
