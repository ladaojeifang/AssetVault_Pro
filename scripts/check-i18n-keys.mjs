/**
 * Ensure zh-CN and en-US locale JSON files have identical key sets per namespace.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = join(root, 'src', 'renderer', 'src', 'i18n', 'locales')

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

const langs = ['zh-CN', 'en-US']
const namespaces = readdirSync(join(localesDir, 'zh-CN'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))

let failed = false

for (const ns of namespaces) {
  const byLang = {}
  for (const lang of langs) {
    const p = join(localesDir, lang, `${ns}.json`)
    byLang[lang] = new Set(flattenKeys(JSON.parse(readFileSync(p, 'utf8'))))
  }
  const zh = [...byLang['zh-CN']].sort()
  const en = [...byLang['en-US']].sort()
  const missingInEn = zh.filter((k) => !byLang['en-US'].has(k))
  const missingInZh = en.filter((k) => !byLang['zh-CN'].has(k))
  if (missingInEn.length || missingInZh.length) {
    failed = true
    console.error(`[i18n] namespace "${ns}" key mismatch`)
    if (missingInEn.length) console.error('  missing in en-US:', missingInEn.join(', '))
    if (missingInZh.length) console.error('  missing in zh-CN:', missingInZh.join(', '))
  }
}

if (failed) process.exit(1)
console.log(`[i18n] ${namespaces.length} namespaces OK (zh-CN ↔ en-US)`)
