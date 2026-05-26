/**
 * Inspect a library folder (manifest + library.sqlite + corrupt backups).
 * Usage: node scripts/inspect-library.mjs "D:\path\to\your\library"
 */
import Database from 'better-sqlite3'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const root = process.argv[2]
if (!root) {
  console.error('Usage: node scripts/inspect-library.mjs <library-root-path>')
  process.exit(1)
}

const dbPath = join(root, 'library.sqlite')
const manifestPath = join(root, 'manifest.json')

console.log('Library root:', root)
console.log('')

if (existsSync(manifestPath)) {
  try {
    const m = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    console.log('manifest.json libraryMode:', m.libraryMode ?? '(missing)')
    console.log('displayName:', m.displayName ?? '(missing)')
  } catch (e) {
    console.log('manifest.json: parse error', e.message)
  }
} else {
  console.log('manifest.json: not found')
}

function reportDb(label, path) {
  if (!existsSync(path)) {
    console.log(`${label}: (missing)`)
    return
  }
  const st = statSync(path)
  console.log(`${label}: ${path}`)
  console.log(`  size: ${st.size} bytes`)
  try {
    const db = new Database(path, { readonly: true })
    const assets = db.prepare('SELECT count(*) AS c FROM assets').get()
    const ref = db
      .prepare(
        `SELECT count(*) AS c FROM assets WHERE storage_mode = 'referenced' OR (length(trim(file_path)) >= 2 AND substr(trim(file_path), 2, 1) = ':')`
      )
      .get()
    db.close()
    console.log(`  assets: ${assets?.c ?? 0} (referenced-like: ${ref?.c ?? 0})`)
  } catch (e) {
    console.log(`  open failed: ${e.message}`)
  }
}

console.log('')
reportDb('library.sqlite', dbPath)

console.log('')
console.log('Backups:')
let any = false
for (const name of readdirSync(root)) {
  if (!name.startsWith('library.sqlite.corrupt-')) continue
  any = true
  reportDb(name, join(root, name))
}
if (!any) console.log('  (none)')
