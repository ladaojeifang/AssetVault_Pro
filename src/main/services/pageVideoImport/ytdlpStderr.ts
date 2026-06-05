export function isBrowserCookieReadFailure(stderr: string): boolean {
  return (
    /could not copy.*cookie database/i.test(stderr) ||
    /failed to decrypt with dpapi/i.test(stderr)
  )
}

export function classifyStderr(stderr: string): string {
  if (isBrowserCookieReadFailure(stderr)) {
    return 'YTDLP_COOKIE_COPY_FAILED'
  }
  const s = stderr.toLowerCase()
  if (
    /sign in|login required|please log in|use --cookies|authentication|private video|members only|age.?restricted|this video is private/.test(
      s
    )
  ) {
    return 'YTDLP_AUTH_REQUIRED'
  }
  if (/unsupported url|no video|unable to extract|extractor/.test(s)) {
    return 'YTDLP_EXTRACTOR_FAILED'
  }
  if (/requested format is not available|no suitable formats|format is not available/.test(s)) {
    return 'YTDLP_FORMAT_UNAVAILABLE'
  }
  if (/post.?process|merger|ffmpeg|extractaudio/.test(s)) {
    return 'YTDLP_POSTPROCESS_FAILED'
  }
  return 'YTDLP_DOWNLOAD_FAILED'
}

/** Last N non-empty lines from yt-dlp stderr (xiaoer-style diagnostics). */
export function stderrTailLines(stderr: string, maxLines = 15): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length <= maxLines) return lines.join('\n')
  return lines.slice(-maxLines).join('\n')
}

export function parseProgress(line: string): number | null {
  const m = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null
}
