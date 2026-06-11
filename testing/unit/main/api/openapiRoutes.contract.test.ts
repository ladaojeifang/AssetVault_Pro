import '../../../helpers/registerElectronMock'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listAllApiRouteOperations } from '@main/api/routes'
// @ts-expect-error — plain .mjs helper
import { openApiHasOperation, parseOpenApiPathMethods } from '../../../../scripts/lib/openapi-paths.mjs'

const OPENAPI_PATH = join(process.cwd(), 'doc/web-api-v1-openapi.yaml')

function stripApiPrefix(path: string): string {
  return path.replace(/^\/api\/v1/, '') || '/'
}

describe('OpenAPI ↔ listApiRoutes contract', () => {
  const yaml = readFileSync(OPENAPI_PATH, 'utf8')
  const openapi = parseOpenApiPathMethods(yaml)
  const implemented = listAllApiRouteOperations()

  it('every implemented route is documented in OpenAPI', () => {
    const missing: string[] = []
    for (const { method, path } of implemented) {
      const docPath = stripApiPrefix(path)
      if (!openApiHasOperation(openapi, docPath, method)) {
        missing.push(`${method} ${docPath}`)
      }
    }
    expect(missing, `Missing in ${OPENAPI_PATH}:\n${missing.join('\n')}`).toEqual([])
  })

  it('core extension-facing routes stay implemented', () => {
    const required = [
      ['GET', '/app/info'],
      ['POST', '/asset/import'],
      ['POST', '/asset/fullPageSession/start'],
      ['POST', '/asset/articleBundleSession/start'],
      ['POST', '/asset/pageVideoImport']
    ] as const

    const implKeys = new Set(implemented.map((r) => `${r.method} ${stripApiPrefix(r.path)}`))
    for (const [method, path] of required) {
      expect(implKeys.has(`${method} ${path}`)).toBe(true)
    }
  })
})
