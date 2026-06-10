import { protocol } from 'electron'
import { readFile } from 'fs/promises'
import { extname } from 'path'

const SCHEME = 'assetvault-model'

const MIME_BY_EXT: Record<string, string> = {
  '.obj': 'text/plain; charset=utf-8',
  '.mtl': 'text/plain; charset=utf-8',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.fbx': 'application/octet-stream',
  '.stl': 'model/stl',
  '.ply': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttc': 'font/collection',
  '.eot': 'application/vnd.ms-fontobject'
}

/**
 * Resolve absolute FS path from a custom model URL.
 *
 * - Canonical: assetvault-model:///C:/Users/... → C:/Users/...
 * - After fetch/Babylon normalization: assetvault-model://c/Users/... (host = drive letter)
 *   Without handling that, pathname becomes Users/... relative → wrong tree under cwd.
 */
export function absPathFromModelRequestUrl(requestUrl: string): string {
  const u = new URL(requestUrl)
  let pathname = decodeURIComponent(u.pathname).replace(/\\/g, '/')

  const host = u.hostname
  if (/^[a-zA-Z]$/.test(host)) {
    const rest = pathname.startsWith('/') ? pathname.slice(1) : pathname
    return `${host.toUpperCase()}:/${rest}`
  }

  if (/^\/[a-zA-Z]:/.test(pathname)) {
    return pathname.slice(1)
  }

  return pathname.startsWith('/') ? pathname.slice(1) : pathname
}

/** Allow renderer (http://localhost) to fetch library model files for Babylon loaders. */
export function registerModelFileProtocol(): void {
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

export function setupModelFileProtocolHandler(): void {
  protocol.handle(SCHEME, async (request) => {
    try {
      const abs = absPathFromModelRequestUrl(request.url)
      const body = await readFile(abs)
      const ext = extname(abs).toLowerCase()
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (err) {
      console.error('[modelFileProtocol] failed:', request.url, err)
      return new Response(null, { status: 404, statusText: 'Not Found' })
    }
  })
}
