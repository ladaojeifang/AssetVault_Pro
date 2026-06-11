#!/usr/bin/env node
/**
 * Pre-push guard: refuse to push if the target tree still contains local-only paths.
 * Wired from .githooks/pre-push (reads ref updates from stdin).
 */
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ZERO = '0'.repeat(40)

/** Paths that must not exist in the tree pushed to GitHub */
const BLOCKED_PATTERNS = [
  /^doc-internal\//,
  /^doc\/DEVELOPMENT_PLAN\.md$/,
  /^doc\/AssetVault_Hub_PRD/,
  /^doc\/AssetVault_Pro_PRD.*\.md$/,
  /^doc\/exr-preview-fix-plan\.md$/,
  /^doc\/exr-preview-manual-acceptance\.md$/,
  /^doc\/page-video-import-fix-plan\.md$/,
  /^doc\/i18n-inventory\.md$/,
  /^doc\/examples\/import_gulu2_prompts\.py$/,
  /^doc\/examples\/ensure_tag_renxiao\.py$/,
  /^scripts\/test_catalog_merge\.py$/,
  /^scripts\/check_remote_imports_refs\.py$/,
  /^eagle插件探索方式\.md$/,
  /\.docx$/,
  /\.doc$/,
  /^\.env$/,
  /^\.env\.local$/,
  /^data\//,
  /\.db$/,
  /^release\//,
  /^out\//
]

function parsePushRefs(stdin) {
  const lines = stdin
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) {
    return [{ localSha: 'HEAD' }]
  }
  return lines.map((line) => {
    const parts = line.split(/\s+/)
    return { localSha: parts[1] ?? 'HEAD' }
  })
}

function listTrackedFilesAt(sha) {
  const out = execSync(`git ls-tree -r --name-only ${sha}`, {
    cwd: root,
    encoding: 'utf8'
  })
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

function isBlocked(path) {
  const normalized = path.replace(/\\/g, '/')
  return BLOCKED_PATTERNS.some((re) => re.test(normalized))
}

const stdin = readFileSync(0, 'utf8')
const refs = parsePushRefs(stdin)
const allBlocked = new Set()

for (const { localSha } of refs) {
  if (!localSha || localSha === ZERO) continue
  for (const file of listTrackedFilesAt(localSha)) {
    if (isBlocked(file)) allBlocked.add(file)
  }
}

if (allBlocked.size > 0) {
  console.error('\n[pre-push] Blocked: these paths must not be on GitHub:\n')
  for (const f of [...allBlocked].sort()) console.error(`  - ${f}`)
  console.error('\nMove them under doc-internal/ (see doc-internal.template/README.md).\n')
  process.exit(1)
}

console.log('[pre-push] OK — tree safe for public push')
process.exit(0)
