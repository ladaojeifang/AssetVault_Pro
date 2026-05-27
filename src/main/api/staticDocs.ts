import { readFileSync, existsSync, statSync } from 'fs'
import { join, normalize, extname } from 'path'
import type { ServerResponse } from 'http'
import { app } from 'electron'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
}

function projectRoots(): string[] {
  const roots = new Set<string>([process.cwd()])
  try {
    if (app?.getAppPath) {
      roots.add(app.getAppPath())
      roots.add(join(app.getAppPath(), '..'))
    }
    if (process.resourcesPath) roots.add(process.resourcesPath)
  } catch {
    /* pre-ready */
  }
  return [...roots]
}

function resolveFirstExisting(relPaths: string[]): string | null {
  for (const root of projectRoots()) {
    for (const rel of relPaths) {
      const full = join(root, rel)
      if (existsSync(full)) return full
    }
  }
  return null
}

export function resolveOpenApiYamlPath(): string | null {
  return resolveFirstExisting([
    'doc/web-api-v1-openapi.yaml',
    'web-api-v1-openapi.yaml'
  ])
}

export function resolvePlaygroundIndexPath(): string | null {
  return resolveFirstExisting([
    'resources/api-playground/index.html',
    join('api-playground', 'index.html')
  ])
}

function sendFile(res: ServerResponse, filePath: string): boolean {
  if (!existsSync(filePath)) return false
  const ext = extname(filePath).toLowerCase()
  const body = readFileSync(filePath)
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'no-cache'
  })
  res.end(body)
  return true
}

/** Docs/playground routes — no auth. Returns true if handled. */
export function tryServeStaticDocs(pathname: string, res: ServerResponse): boolean {
  if (pathname === '/api/v1/docs/openapi.yaml') {
    const p = resolveOpenApiYamlPath()
    if (p && sendFile(res, p)) return true
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('openapi.yaml not found')
    return true
  }

  const playgroundPath = pathname.replace(/\/+$/, '') || '/'
  if (playgroundPath === '/api/v1/playground') {
    const p = resolvePlaygroundIndexPath()
    if (p && sendFile(res, p)) return true
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('playground not found')
    return true
  }

  return false
}
