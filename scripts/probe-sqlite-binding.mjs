import { existsSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'

const p = join(process.cwd(), 'resources', 'better_sqlite3.node')
console.log('cwd:', process.cwd())
console.log('binding:', p, 'exists:', existsSync(p))
try {
  const db = new Database(':memory:', { nativeBinding: p })
  db.close()
  console.log('probe: OK')
} catch (e) {
  console.error('probe: FAIL', e?.message ?? e)
  process.exit(1)
}
