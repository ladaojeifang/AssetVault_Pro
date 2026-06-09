import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  libraryPathKey,
  readLibraryUserState,
  removeFromRecentList,
  writeLibraryUserState
} from './libraryBundle'

describe('library recent list', () => {
  let userData = ''

  afterEach(() => {
    if (userData) {
      try {
        rmSync(userData, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
      userData = ''
    }
  })

  function seedState(recentLibraries: string[], active = recentLibraries[0]!) {
    userData = mkdtempSync(join(tmpdir(), 'av-lib-recent-'))
    writeLibraryUserState(userData, { activeLibraryRoot: active, recentLibraries })
  }

  it('removeFromRecentList drops a non-active library', () => {
    seedState(['C:/libs/active', 'C:/libs/old-a', 'C:/libs/old-b'], 'C:/libs/active')
    removeFromRecentList(userData, 'C:/libs/old-a')
    const next = readLibraryUserState(userData)
    expect(next?.recentLibraries.map(libraryPathKey)).toEqual([
      libraryPathKey('C:/libs/active'),
      libraryPathKey('C:/libs/old-b')
    ])
  })

  it('removeFromRecentList rejects removing the active library', () => {
    seedState(['C:/libs/active', 'C:/libs/old-a'], 'C:/libs/active')
    expect(() => removeFromRecentList(userData, 'C:/libs/active')).toThrow(/当前正在使用/)
  })

  it('removeFromRecentList rejects unknown paths', () => {
    seedState(['C:/libs/active', 'C:/libs/old-a'], 'C:/libs/active')
    expect(() => removeFromRecentList(userData, 'C:/libs/missing')).toThrow(/不在最近列表/)
  })

  it('libraryPathKey treats equivalent Windows paths as equal when they exist', () => {
    userData = mkdtempSync(join(tmpdir(), 'av-lib-recent-'))
    const dir = join(userData, 'lib-a')
    mkdirSync(dir, { recursive: true })
    const withSlash = dir.replace(/\\/g, '/')
    expect(libraryPathKey(withSlash)).toBe(libraryPathKey(dir))
  })
})
