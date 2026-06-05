import type { IncomingMessage } from 'http'
import { forbidden } from './errors'

const PAGE_VIDEO_WRITE_PREFIX = '/api/v1/asset/pageVideoImport'

/** Block drive-by downloads from arbitrary web pages (xiaoer-videolab pattern). */
export function assertPageVideoWriteOrigin(req: IncomingMessage, pathname: string): void {
  const method = (req.method ?? 'GET').toUpperCase()
  if (method !== 'POST') return
  if (!pathname.startsWith(PAGE_VIDEO_WRITE_PREFIX)) return

  const origin = (req.headers.origin ?? '').trim()
  if (origin.startsWith('http://') || origin.startsWith('https://')) {
    throw forbidden('网页来源不能触发作品页视频下载')
  }
}
