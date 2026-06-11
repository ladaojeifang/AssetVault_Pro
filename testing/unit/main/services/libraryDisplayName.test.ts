import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import { readLibraryDisplayName } from '@main/services/libraryManifest'

describe('readLibraryDisplayName', () => {
  let root = ''

  afterEach(() => {
    if (root) {
      try {
        rmSync(root, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
      root = ''
    }
  })

  function writeManifest(body: Record<string, unknown>) {
    writeFileSync(join(root, 'manifest.json'), JSON.stringify(body), 'utf-8')
  }

  it('uses folder basename when manifest is missing', () => {
    root = mkdtempSync(join(tmpdir(), 'av-lib-label-'))
    mkdirSync(join(root, 'nested'), { recursive: true })
    expect(readLibraryDisplayName(join(root, 'nested'))).toBe('nested')
  })

  it('ignores factory default displayName and uses folder basename', () => {
    root = mkdtempSync(join(tmpdir(), 'av-lib-label-'))
    writeManifest({ displayName: 'AssetVault Library', libraryMode: 'archive' })
    expect(readLibraryDisplayName(root)).toBe(root.split(/[/\\]/).pop())
  })

  it('keeps a custom displayName', () => {
    root = mkdtempSync(join(tmpdir(), 'av-lib-label-'))
    writeManifest({ displayName: 'My Project Vault', libraryMode: 'archive' })
    expect(readLibraryDisplayName(root)).toBe('My Project Vault')
  })

  it('derives embedded infra subfolder label from ParentName-uuid pattern', () => {
    const projectParent = mkdtempSync(join(tmpdir(), 'av-embed-'))
    const projectRoot = join(projectParent, 'MyProject')
    mkdirSync(projectRoot, { recursive: true })
    const embeddedRoot = join(projectRoot, 'MyProject-a1b2c3d4')
    mkdirSync(embeddedRoot, { recursive: true })
    writeFileSync(
      join(embeddedRoot, 'manifest.json'),
      JSON.stringify({ displayName: 'AssetVault Library', libraryMode: 'embedded' }),
      'utf-8'
    )
    root = projectParent
    expect(readLibraryDisplayName(embeddedRoot)).toBe('MyProject')
  })
})
