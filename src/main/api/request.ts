import type { IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'

export type ApiRequestContext = {
  method: string
  pathname: string
  query: Record<string, string>
  body: Record<string, unknown>
  headers: IncomingMessage['headers']
}

const MAX_BODY_BYTES = 2 * 1024 * 1024

export function parseQuery(url: URL): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of url.searchParams.entries()) {
    out[key] = value
  }
  return out
}

export async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > MAX_BODY_BYTES) {
      throw new Error('Request body too large')
    }
    chunks.push(buf)
  }
  if (chunks.length === 0) return {}
  const raw = Buffer.concat(chunks).toString('utf-8').trim()
  if (!raw) return {}
  const parsed = JSON.parse(raw) as unknown
  if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>
  }
  throw new Error('JSON body must be an object')
}

export function buildRequestContext(
  req: IncomingMessage,
  body: Record<string, unknown>
): ApiRequestContext {
  const host = req.headers.host ?? '127.0.0.1'
  const url = new URL(req.url ?? '/', `http://${host}`)
  return {
    method: (req.method ?? 'GET').toUpperCase(),
    pathname: url.pathname.replace(/\/+$/, '') || '/',
    query: parseQuery(url),
    body,
    headers: req.headers
  }
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}
