import type { ApiRequestContext } from './request'
import type { ApiServerConfig } from './config'
import { unauthorized } from './errors'

function extractToken(ctx: ApiRequestContext): string | undefined {
  const auth = ctx.headers.authorization
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }
  const q = ctx.query.token
  if (typeof q === 'string' && q) return q
  return undefined
}

export function assertAuthorized(config: ApiServerConfig, ctx: ApiRequestContext): void {
  if (!config.allowRemote) return
  const expected = config.token
  if (!expected) {
    throw unauthorized()
  }
  const got = extractToken(ctx)
  if (!got || got !== expected) {
    throw unauthorized()
  }
}
