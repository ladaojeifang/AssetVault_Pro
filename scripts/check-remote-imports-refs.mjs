/**
 * List assets whose file_path or import_source still points at remote-imports/.
 *
 * Usage:
 *   node scripts/check-remote-imports-refs.mjs "G:\temp\gulu2api"
 */
import Database from 'better-sqlite3'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const root = process.argv[2]
if (!root) {
  console.error('Usage: node scripts/check-remote-imports-refs.mjs <library-root-path>')
  process.exit(1)
}

const dbPath = join(root, 'library.sqlite')
if (!existsSync(dbPath)) {
  console.error('library.sqlite not found:', dbPath)
  process.exit(1)
}

const remoteImportsDir = join(root, 'remote-imports')
let diskBytes = 0
let diskFiles = 0
if (existsSync(remoteImportsDir)) {
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (ent.isFile()) {
        diskFiles++
        diskBytes += statSync(p).size
      }
    }
  }
  walk(remoteImportsDir)
}

const db = new Database(dbPath, { readonly: true })

const norm = (col) => `lower(replace(replace(${col}, char(92), '/'), char(92), '/'))`

const summary = db
  .prepare(
    `
    SELECT
      count(*) AS total_assets,
      sum(CASE WHEN ${norm('file_path')} LIKE '%remote-imports/%' OR ${norm('file_path')} LIKE '%remote-imports\\%' THEN 1 ELSE 0 END) AS file_path_refs,
      sum(CASE WHEN import_source IS NOT NULL AND (${norm('import_source')} LIKE '%remote-imports/%' OR ${norm('import_source')} LIKE '%remote-imports\\%') THEN 1 ELSE 0 END) AS import_source_refs,
      sum(CASE WHEN
        ${norm('file_path')} LIKE '%remote-imports/%' OR ${norm('file_path')} LIKE '%remote-imports\\%'
        OR (import_source IS NOT NULL AND (${norm('import_source')} LIKE '%remote-imports/%' OR ${norm('import_source')} LIKE '%remote-imports\\%'))
      THEN 1 ELSE 0 END) AS any_ref
    FROM assets
  `
  )
  .get()

const rows = db
  .prepare(
    `
    SELECT
      id,
      filename,
      storage_mode,
      file_path,
      import_source,
      CASE
        WHEN ${norm('file_path')} LIKE '%remote-imports/%' OR ${norm('file_path')} LIKE '%remote-imports\\%' THEN 'file_path'
        WHEN import_source IS NOT NULL AND (${norm('import_source')} LIKE '%remote-imports/%' OR ${norm('import_source')} LIKE '%remote-imports\\%') THEN 'import_source'
        ELSE 'other'
      END AS ref_field
    FROM assets
    WHERE
      ${norm('file_path')} LIKE '%remote-imports/%' OR ${norm('file_path')} LIKE '%remote-imports\\%'
      OR (import_source IS NOT NULL AND (${norm('import_source')} LIKE '%remote-imports/%' OR ${norm('import_source')} LIKE '%remote-imports\\%'))
    ORDER BY filename
  `
  )
  .all()

db.close()

console.log('Library root:', root)
console.log('')
console.log('remote-imports on disk:')
console.log(`  files: ${diskFiles}`)
console.log(`  size:  ${(diskBytes / 1024 / 1024).toFixed(2)} MB`)
console.log('')
console.log('DB summary:')
console.log(`  total assets:           ${summary.total_assets}`)
console.log(`  file_path → remote:     ${summary.file_path_refs}`)
console.log(`  import_source → remote: ${summary.import_source_refs}`)
console.log(`  any reference:          ${summary.any_ref}`)
console.log('')

if (rows.length === 0) {
  console.log('No assets reference remote-imports in file_path or import_source.')
  console.log('(Disk cache under remote-imports/ may still exist and be safe to prune if items/ has copies.)')
} else {
  console.log(`Assets still referencing remote-imports (${rows.length}):`)
  console.log('')
  for (const r of rows) {
    console.log(`- ${r.filename}`)
    console.log(`  id: ${r.id}`)
    console.log(`  storage_mode: ${r.storage_mode}`)
    console.log(`  ref_field: ${r.ref_field}`)
    console.log(`  file_path: ${r.file_path}`)
    if (r.import_source) console.log(`  import_source: ${r.import_source}`)
    console.log('')
  }
}
