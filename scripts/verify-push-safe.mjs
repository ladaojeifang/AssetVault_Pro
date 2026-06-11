#!/usr/bin/env node
/**
 * Pre-push guard: refuse to push commits that contain paths meant to stay local.
 * Wired from .githooks/pre-push
 */
import { execSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Paths that must never appear in commits pushed to GitHub */
const BLOCKED_PATTERNS = [
  /^doc-internal\//,
  /^doc\/DEVELOPMENT_PLAN\.md$/,
  /^doc\/AssetVault_Hub_PRD/,
  /^doc\/AssetVault_Pro_PRD/,
  /^doc\/exr-preview-fix-plan\.md$/,
  /^doc\/exr-preview-manual-acceptance\.md$/,
  /^doc\/page-video-import-fix-plan\.md$/,
  /^doc\/i18n-inventory\.md$/,
  /^doc\/examples\/import_gulu2_prompts\.py$/,
  /^doc\/examples\/ensure_tag_renxiao\.py$/,
  /^scripts\/test_catalog_merge\.py$/,
  /^scripts\/check_remote_imports_refs\.py$/,
  /^eagle插件探索方式\.md$/,
  /^\.env$/,
  /^\.env\.local$/,
  /^data\//,
  /\.db$/,
  /^release\//,
  /^out\//
]

function listFilesInRange(remote, localSha) {
  if (!remote || remote === '0000000000000000000000000000000000000000') {
    return []
  }
  const out = execSync(`git diff --name-only ${remote} ${localSha}`, {
    cwd: root,
    encoding: 'utf8'
  })
  return out.split('\n').map((l) => l.trim()).filter(Boolean)
}

const remoteRef = process.argv[2] ?? ''
const localSha = process.argv[3] ?? 'HEAD'

let files = []
try {
  files = listFilesInRange(remoteRef, localSha)
} catch {
  files = execSync('git diff --name-only HEAD~1 HEAD', { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

const blocked = files.filter((f) => BLOCKED_PATTERNS.some((re) => re.test(f.replace(/\\/g, '/'))))

if (blocked.length > 0) {
  console.error('\n[pre-push] Blocked: these paths must not be pushed to GitHub:\n')
  for (const f of blocked) console.error(`  - ${f}`)
  console.error('\nMove them under doc-internal/ (see doc-internal.template/README.md) and amend your commit.\n')
  process.exit(1)
}

console.log('[pre-push] OK — no blocked paths in outgoing commits')
process.exit(0)
