import { createServer, type Server } from 'http'
import type { IncomingMessage, ServerResponse } from 'http'
import { ApiError, internalError, invalidRequest } from './errors'
import type { ApiServerConfig } from './config'
import { resolveApiServerConfig } from './config'
import { assertAuthorized } from './auth'
import { matchRoute } from './routes'
import {
  buildRequestContext,
  MAX_BODY_BYTES_FULLPAGE_APPEND,
  readJsonBody,
  sendJson
} from './request'
import { tryServeStaticDocs } from './staticDocs'
import { getAppPreferencesSnapshot } from '../services/appPreferencesStore'
import { preferencesToApiConfig } from './webApiRuntime'

let server: Server | null = null
let activeConfig: ApiServerConfig | null = null

export function getApiServer(): Server | null {
  return server
}

export function getApiServerConfig(): ApiServerConfig | null {
  return activeConfig
}

async function handleRequest(
  config: ApiServerConfig,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const host = req.headers.host ?? '127.0.0.1'
    const url = new URL(req.url ?? '/', `http://${host}`)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'

    if (tryServeStaticDocs(pathname, res)) {
      return
    }

    const method = (req.method ?? 'GET').toUpperCase()
    let body: Record<string, unknown> = {}
    if (method === 'POST' || method === 'DELETE' || method === 'PATCH' || method === 'PUT') {
      const largeBody =
        method === 'POST' && pathname === '/api/v1/asset/fullPageSession/append'
      body = await readJsonBody(req, largeBody ? MAX_BODY_BYTES_FULLPAGE_APPEND : undefined)
    }
    const ctx = buildRequestContext(req, body)
    assertAuthorized(config, ctx)

    const handler = matchRoute(ctx)
    if (!handler) {
      sendJson(res, 404, {
        status: 'error',
        code: 'NOT_FOUND',
        message: `未找到路由: ${ctx.method} ${ctx.pathname}`
      })
      return
    }

    const result = await handler(ctx)
    sendJson(res, 200, result)
  } catch (err) {
    if (err instanceof ApiError) {
      sendJson(res, err.httpStatus, {
        status: 'error',
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {})
      })
      return
    }
    if (err instanceof SyntaxError) {
      const e = invalidRequest('无效的 JSON 请求体')
      sendJson(res, e.httpStatus, { status: 'error', code: e.code, message: e.message })
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Request body too large') {
      const e = invalidRequest(message)
      sendJson(res, e.httpStatus, { status: 'error', code: e.code, message: e.message })
      return
    }
    console.error('[WebAPI]', err)
    const apiErr = internalError(message)
    sendJson(res, apiErr.httpStatus, {
      status: 'error',
      code: apiErr.code,
      message: apiErr.message
    })
  }
}

export async function startApiServer(
  overrides?: Partial<ApiServerConfig>,
  options?: { force?: boolean }
): Promise<void> {
  if (server && !options?.force) return

  if (server) {
    await stopApiServer()
  }

  const config = overrides ? { ...resolveApiServerConfig(), ...overrides } : resolveApiServerConfig()
  activeConfig = config

  const httpServer = createServer((req, res) => {
    void handleRequest(config, req, res)
  })

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(config.port, config.host, () => resolve())
  })

  server = httpServer
  const displayHost = config.host === '0.0.0.0' ? '127.0.0.1' : config.host
  console.log(`[WebAPI] Listening on http://${displayHost}:${config.port}/api/v1/`)
  console.log(`[WebAPI] Playground: http://${displayHost}:${config.port}/api/v1/playground/`)
}

export async function stopApiServer(): Promise<void> {
  if (!server) return
  await new Promise<void>((resolve, reject) => {
    server!.close((err) => (err ? reject(err) : resolve()))
  })
  server = null
  activeConfig = null
}

export async function restartApiServer(overrides?: Partial<ApiServerConfig>): Promise<void> {
  await stopApiServer()
  const prefs = getAppPreferencesSnapshot().webApi
  if (!prefs.enabled) return
  await startApiServer(overrides ?? preferencesToApiConfig(prefs), { force: true })
}
