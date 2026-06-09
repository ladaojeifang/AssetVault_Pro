import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getEmbeddedProjectRoot,
  isEmbeddedInPlaceImport,
  isPathUnderRoot
} from './embeddedAssetImport'
import { itemPackFileRelative } from './libraryBundle'
import { posixRelToFsAbs } from './importSingleAssetHelpers'

describe('embeddedAssetImport', () => {
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

  function seedEmbeddedLayout() {
    root = mkdtempSync(join(tmpdir(), 'av-embedded-import-'))
    const projectRoot = join(root, 'MyProject')
    const libraryRoot = join(projectRoot, 'MyProject-abc12345')
    mkdirSync(join(libraryRoot, 'items'), { recursive: true })
    mkdirSync(join(projectRoot, 'assets'), { recursive: true })
    writeFileSync(join(projectRoot, 'assets', 'in-project.png'), 'png')
    return { projectRoot, libraryRoot }
  }

  it('getEmbeddedProjectRoot returns parent of library metadata folder', () => {
    const { projectRoot, libraryRoot } = seedEmbeddedLayout()
    expect(getEmbeddedProjectRoot(libraryRoot)).toBe(projectRoot)
  })

  it('treats in-project files as in-place embedded imports', () => {
    const { projectRoot, libraryRoot } = seedEmbeddedLayout()
    const inProject = join(projectRoot, 'assets', 'in-project.png')
    expect(isEmbeddedInPlaceImport(libraryRoot, inProject)).toBe(true)
  })

  it('treats files under library metadata folder as in-place embedded imports', () => {
    const { libraryRoot } = seedEmbeddedLayout()
    const inside = join(libraryRoot, 'notes.txt')
    writeFileSync(inside, 'text')
    expect(isEmbeddedInPlaceImport(libraryRoot, inside)).toBe(true)
  })

  it('treats external files as pack imports (items/{id}/)', () => {
    const { libraryRoot } = seedEmbeddedLayout()
    const externalFile = join(root, 'ExternalPack', 'wood.png')
    mkdirSync(join(root, 'ExternalPack'), { recursive: true })
    writeFileSync(externalFile, 'png')
    expect(isEmbeddedInPlaceImport(libraryRoot, externalFile)).toBe(false)
  })

  it('external imports target items/{id}/ like archive libraries', () => {
    const { libraryRoot } = seedEmbeddedLayout()
    const assetId = 'asset-123'
    const rel = itemPackFileRelative(assetId, 'wood.png')
    expect(rel).toBe('items/asset-123/wood.png')
    expect(posixRelToFsAbs(libraryRoot, rel)).toBe(join(libraryRoot, 'items', assetId, 'wood.png'))
  })

  it('isPathUnderRoot handles nested paths', () => {
    expect(isPathUnderRoot('C:/proj/assets/a.png', 'C:/proj')).toBe(true)
    expect(isPathUnderRoot('C:/other/a.png', 'C:/proj')).toBe(false)
  })
})
