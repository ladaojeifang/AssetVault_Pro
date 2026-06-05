import { PAGE_VIDEO_IMPORT_LIMITS } from './pageVideoImportTypes'

export type PageVideoFormatPreset = 'best' | '1080p_mp4' | '2160p_mp4' | 'audio_only'

export const PAGE_VIDEO_FORMAT_PRESETS: PageVideoFormatPreset[] = [
  'best',
  '1080p_mp4',
  '2160p_mp4',
  'audio_only'
]

export function normalizePageVideoFormatPreset(value: unknown): PageVideoFormatPreset | undefined {
  if (
    value === 'best' ||
    value === '1080p_mp4' ||
    value === '2160p_mp4' ||
    value === 'audio_only'
  ) {
    return value
  }
  return undefined
}

/**
 * Height-capped video+audio merge chain. Output container is mp4 via `--merge-output-format`.
 * Do not require `[ext=mp4]` on YouTube — streams are often webm+m4a DASH.
 */
export function buildMp4FormatChain(height: number): string {
  const h = Math.min(4320, Math.max(144, Math.floor(height)))
  return (
    `bv*[height<=${h}]+ba/` +
    `b[height<=${h}]/` +
    `bv*+ba/` +
    `bestvideo[height<=${h}]+bestaudio/best`
  )
}

export function resolveFormatFromPreset(
  preset: PageVideoFormatPreset,
  maxVideoHeight?: number
): string | null {
  switch (preset) {
    case 'audio_only':
      return 'bestaudio/best'
    case '2160p_mp4':
      return buildMp4FormatChain(maxVideoHeight ?? 2160)
    case '1080p_mp4':
      return buildMp4FormatChain(maxVideoHeight ?? 1080)
    case 'best':
    default:
      return null
  }
}

function platformDefaultFormat(platform: string | undefined | null, height: number): string {
  const h = Math.min(4320, Math.max(144, Math.floor(height)))
  const p = platform?.toLowerCase()
  switch (p) {
    case 'bilibili':
      return (
        `bestvideo[height<=${h}]+bestaudio/` +
        `bestvideo*+bestaudio/best[height<=${h}]/best`
      )
    case 'youtube':
      return buildMp4FormatChain(h)
    case 'douyin':
    case 'xiaohongshu':
    case 'tiktok':
      return `bestvideo[height<=${h}]+bestaudio/bestvideo*+bestaudio/best`
    default:
      return PAGE_VIDEO_IMPORT_LIMITS.defaultFormat
  }
}

export type ResolvePageVideoFormatOptions = {
  formatPreset?: PageVideoFormatPreset | null
  maxVideoHeight?: number
}

/**
 * yt-dlp -f resolution. Explicit `format` wins; then named preset; then platform default.
 */
export function resolvePageVideoFormat(
  platform?: string | null,
  explicit?: string | null,
  opts?: ResolvePageVideoFormatOptions
): string {
  if (explicit?.trim()) return explicit.trim()

  const height = opts?.maxVideoHeight ?? 1080
  const preset = opts?.formatPreset
  if (preset && preset !== 'best') {
    const fromPreset = resolveFormatFromPreset(preset, height)
    if (fromPreset) return fromPreset
  }

  return platformDefaultFormat(platform, height)
}
