#!/usr/bin/env node
/**
 * Verify `listAllApiRouteOperations()` matches doc/web-api-v1-openapi.yaml.
 * Implementation detail: runs the Vitest contract test (needs no Electron GUI).
 */
import { spawnSync } from 'node:child_process'

const r = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'testing/unit/main/api/openapiRoutes.contract.test.ts'],
  { stdio: 'inherit', shell: true, cwd: process.cwd() }
)

process.exit(r.status === 0 ? 0 : 1)
