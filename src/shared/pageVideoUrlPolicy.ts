/** Video/audio file extensions treated as CDN direct media (importFromURL). */
const DIRECT_MEDIA_EXT =
  /\.(mp4|webm|mkv|m4v|mov|m3u8|mp3|m4a|flac|jpe?g|png|gif|webp|avif|svg|bmp|ico|tiff?)(\?|$)/i

const DIRECT_CDN_HOST_PARTS = [
  'googlevideo.com',
  'bilivideo.com',
  'hdslb.com',
  'douyinvod.com',
  'tiktokcdn.com',
  'fbcdn.net'
]

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '::1'
])

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 127) return true
  return false
}

export function parseHttpPageUrl(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    throw new Error('INVALID_REQUEST')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('INVALID_REQUEST')
  }
  const host = parsed.hostname.toLowerCase()
  if (!host) throw new Error('INVALID_REQUEST')
  if (BLOCKED_HOSTS.has(host) || isPrivateIpv4(host)) {
    throw new Error('INVALID_REQUEST')
  }
  return parsed
}

/** True for CDN/file direct links (images, audio, video segments). */
export function isDirectMediaUrl(url: URL): boolean {
  if (DIRECT_MEDIA_EXT.test(url.pathname)) return true
  const host = url.hostname.toLowerCase()
  return DIRECT_CDN_HOST_PARTS.some((part) => host === part || host.endsWith(`.${part}`))
}

type WorkPageRule = (url: URL) => boolean

/** Positive matchers for yt-dlp work pages (not “everything that isn’t direct”). */
const WORK_PAGE_RULES: WorkPageRule[] = [
  (u) => {
    if (u.hostname === 'youtu.be') return u.pathname.length > 1
    if (!/(^|\.)youtube\.com$/i.test(u.hostname)) return false
    if (/^\/shorts\/[^/]+/.test(u.pathname)) return true
    return u.pathname === '/watch' || u.pathname.startsWith('/watch/') ? !!u.searchParams.get('v') : false
  },
  (u) =>
    /(^|\.)bilibili\.com$/i.test(u.hostname) &&
    /\/video\/(BV[\w]+|av\d+)/i.test(u.pathname),
  (u) => /(^|\.)douyin\.com$/i.test(u.hostname) && /\/video\/\d+/.test(u.pathname),
  (u) =>
    /(^|\.)tiktok\.com$/i.test(u.hostname) && /\/@[^/]+\/video\/\d+/.test(u.pathname),
  (u) =>
    /(^|\.)(twitter\.com|x\.com)$/i.test(u.hostname) && /\/status\/\d+/.test(u.pathname),
  (u) =>
    /(^|\.)instagram\.com$/i.test(u.hostname) && /\/(reel|p|tv)\/[^/]+/.test(u.pathname),
  (u) => /(^|\.)vimeo\.com$/i.test(u.hostname) && /^\/\d+/.test(u.pathname),
  (u) =>
    /(^|\.)kuaishou\.com$/i.test(u.hostname) && /\/short-video\//.test(u.pathname),
  (u) =>
    /(^|\.)xiaohongshu\.com$/i.test(u.hostname) &&
    /\/(explore|discovery\/item)\/[^/]+/i.test(u.pathname)
]

function matchesWorkPageRules(url: URL): boolean {
  return WORK_PAGE_RULES.some((rule) => rule(url))
}

export function assertPageVideoUrl(raw: string): URL {
  const url = parseHttpPageUrl(raw)
  if (isDirectMediaUrl(url)) {
    throw new Error('PAGE_VIDEO_NOT_SUPPORTED')
  }
  if (!matchesWorkPageRules(url)) {
    throw new Error('PAGE_VIDEO_NOT_SUPPORTED')
  }
  return url
}

/** True only for known video work pages (YouTube watch, B站 BV, …). */
export function isPageVideoWorkUrl(raw: string): boolean {
  let url: URL
  try {
    url = parseHttpPageUrl(raw)
  } catch {
    return false
  }
  if (isDirectMediaUrl(url)) return false
  return matchesWorkPageRules(url)
}
