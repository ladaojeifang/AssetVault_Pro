/**
 * Move src test files to testing/unit|integration|gen and fix relative imports to @ aliases.
 * Run: node scripts/migrate-tests-to-testing-dir.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function aliasBaseForMirror(mirrorDir) {
  if (mirrorDir === 'shared') return '@/shared'
  if (mirrorDir.startsWith('main/')) return `@main/${mirrorDir.slice('main/'.length)}`
  return `@/${mirrorDir.replace(/\\/g, '/')}`
}

function fixRelativeImports(content, aliasBase) {
  return content.replace(/from '(\.\/[^']+)'/g, (_m, rel) => {
    const mod = rel.slice(2)
    return `from '${aliasBase}/${mod}'`
  })
}

function destFor(srcRel) {
  const base = srcRel.replace(/^src[\\/]/, '')
  if (base.includes('themeFallback.gen.test.ts')) {
    return join('testing', 'gen', 'themeFallback.gen.test.ts')
  }
  if (base.includes('.integration.test.ts')) {
    return join('testing', 'integration', base)
  }
  return join('testing', 'unit', base)
}

function walkSync(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walkSync(p, acc)
    else if (name.endsWith('.test.ts')) acc.push(p)
  }
  return acc
}

const srcTests = walkSync(join(root, 'src'))
let moved = 0

for (const abs of srcTests) {
  const srcRel = relative(root, abs).replace(/\\/g, '/')
  const destRel = destFor(srcRel).replace(/\\/g, '/')
  const destAbs = join(root, destRel)
  mkdirSync(dirname(destAbs), { recursive: true })

  let content = readFileSync(abs, 'utf8')
  if (destRel.startsWith('testing/unit/') || destRel.startsWith('testing/integration/') || destRel.startsWith('testing/gen/')) {
    const prefix = destRel.startsWith('testing/integration/')
      ? 'testing/integration/'
      : destRel.startsWith('testing/gen/')
        ? 'testing/gen/'
        : 'testing/unit/'
    const mirrorDir = destRel.startsWith('testing/gen/') ? 'shared' : dirname(destRel.slice(prefix.length))
    const aliasBase = aliasBaseForMirror(mirrorDir)
    content = fixRelativeImports(content, aliasBase)
  }

  writeFileSync(destAbs, content)
  unlinkSync(abs)
  moved++
  console.log(`${srcRel} → ${destRel}`)
}

console.log(`Moved ${moved} test files.`)
