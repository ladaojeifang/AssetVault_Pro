import { randomUUID } from 'crypto'
import { protocol } from 'electron'
import { LRUCache } from 'lru-cache'

const SCHEME = 'assetvault-exr-preview'

type PreviewEntry = {
  jpeg: Buffer
  createdAt: number
}

const previewCache = new LRUCache<string, PreviewEntry>({
  max: 24,
  ttl: 1000 * 60 * 5
})

export function registerExrPreviewProtocol(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true
      }
    }
  ])
}

export function setupExrPreviewProtocolHandler(): void {
  protocol.handle(SCHEME, async (request) => {
    try {
      const u = new URL(request.url)
      const id = u.pathname.replace(/^\/+/, '').replace(/\.jpg$/i, '')
      const entry = previewCache.get(id)
      if (!entry?.jpeg?.length) {
        return new Response(null, { status: 404, statusText: 'Not Found' })
      }
      return new Response(new Uint8Array(entry.jpeg), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (err) {
      console.error('[exrPreviewCache] protocol failed:', request.url, err)
      return new Response(null, { status: 500, statusText: 'Internal Error' })
    }
  })
}

/** Store JPEG bytes and return a renderer-safe preview URL (avoids base64 IPC). */
export function storeExrPreviewJpeg(jpeg: Buffer): string {
  const id = randomUUID()
  previewCache.set(id, { jpeg, createdAt: Date.now() })
  return `${SCHEME}://cache/${id}.jpg`
}

export function clearExrPreviewCache(): void {
  previewCache.clear()
}

export function exrPreviewCacheSizeForTests(): number {
  return previewCache.size
}
