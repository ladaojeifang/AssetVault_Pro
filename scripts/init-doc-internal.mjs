#!/usr/bin/env node
/**
 * Bootstrap doc-internal/ (gitignored) and migrate files that must not ship to GitHub.
 * Run from repository root: node scripts/init-doc-internal.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join, relative } from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const internalRoot = join(root, 'doc-internal')

/** @type {{ from: string; to: string }[]} */
const MIGRATIONS = [
  { from: 'doc/DEVELOPMENT_PLAN.md', to: 'planning/DEVELOPMENT_PLAN.md' },
  { from: 'doc/AssetVault_Hub_PRD_V1.0.md', to: 'planning/AssetVault_Hub_PRD_V1.0.md' },
  { from: 'doc/AssetVault_Pro_PRD_V1.0.md', to: 'planning/AssetVault_Pro_PRD_V1.0.md' },
  { from: 'doc/exr-preview-fix-plan.md', to: 'maintenance/exr-preview-fix-plan.md' },
  { from: 'doc/exr-preview-manual-acceptance.md', to: 'maintenance/exr-preview-manual-acceptance.md' },
  { from: 'doc/page-video-import-fix-plan.md', to: 'maintenance/page-video-import-fix-plan.md' },
  { from: 'doc/i18n-inventory.md', to: 'maintenance/i18n-inventory.md' },
  { from: 'eagle插件探索方式.md', to: 'references/eagle-extension-notes.md' },
  { from: 'doc/examples/import_gulu2_prompts.py', to: 'examples/import_gulu2_prompts.py' },
  { from: 'doc/examples/ensure_tag_renxiao.py', to: 'examples/ensure_tag_renxiao.py' },
  { from: 'scripts/test_catalog_merge.py', to: 'scripts/test_catalog_merge.py' },
  { from: 'scripts/check_remote_imports_refs.py', to: 'scripts/check_remote_imports_refs.py' }
]

const REGRESSION_FILES = [
  { from: 'doc-internal.template/regression/manual-regression.md', to: 'regression/manual-regression.md' },
  { from: 'doc-internal.template/regression/architecture-risks.md', to: 'regression/architecture-risks.md' },
  { from: 'doc-internal.template/regression/smoke-test-catalog-merge.md', to: 'regression/smoke-test-catalog-merge.md' }
]

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
}

function migrateOne(fromRel, toRel) {
  const from = join(root, fromRel)
  const to = join(internalRoot, toRel)
  if (!existsSync(from)) {
    if (existsSync(to)) return false
    console.warn(`  skip (missing): ${fromRel}`)
    return false
  }
  ensureDir(to)
  cpSync(from, to)
  console.log(`  copied: ${fromRel} → doc-internal/${toRel}`)
  return true
}

function gitRm(fromRel) {
  try {
    execSync(`git rm -f --ignore-unmatch "${fromRel}"`, { cwd: root, stdio: 'pipe' })
    const still = join(root, fromRel)
    if (existsSync(still)) {
      try {
        renameSync(still, join(internalRoot, '.migrated-trash', fromRel.replace(/[/\\]/g, '__')))
      } catch {
        // source may already be gone after git rm
      }
    }
  } catch (e) {
    console.warn(`  git rm warning for ${fromRel}:`, e.message)
  }
}

function initNestedGit() {
  const nested = join(internalRoot, '.git')
  if (existsSync(nested)) {
    console.log('doc-internal/.git already exists — skipped nested git init')
    return
  }
  execSync('git init -b main', { cwd: internalRoot, stdio: 'inherit' })
  writeFileSync(
    join(internalRoot, '.gitignore'),
    '# Optional local scratch inside internal docs\n.local/\n',
    'utf8'
  )
  execSync('git add .', { cwd: internalRoot, stdio: 'inherit' })
  try {
    execSync('git commit -m "chore: initial internal documentation snapshot"', {
      cwd: internalRoot,
      stdio: 'inherit'
    })
  } catch {
    console.log('Nothing to commit in doc-internal yet')
  }
}

console.log('Creating doc-internal/ …')
mkdirSync(internalRoot, { recursive: true })

const readmeSrc = join(root, 'doc-internal.template/README.md')
const readmeDst = join(internalRoot, 'README.md')
if (existsSync(readmeSrc)) {
  cpSync(readmeSrc, readmeDst)
}

for (const { from, to } of MIGRATIONS) {
  if (migrateOne(from, to)) {
    gitRm(from)
  }
}

for (const { from, to } of REGRESSION_FILES) {
  migrateOne(from, to)
}

initNestedGit()
console.log('\nDone. doc-internal/ is gitignored by the parent repo; use cd doc-internal && git for local history.')
console.log('Public doc index: doc/README.md — commit remaining changes, then git push origin main')
