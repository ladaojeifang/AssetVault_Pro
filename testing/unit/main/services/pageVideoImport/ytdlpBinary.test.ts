import { existsSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { getBundledYtdlpRelPath, resolveBundledYtdlpPath } from '@main/services/pageVideoImport/ytdlpBinary'

describe('ytdlpBinary bundled path', () => {
  it('getBundledYtdlpRelPath points at extraResources target', () => {
    const rel = getBundledYtdlpRelPath()
    if (process.platform === 'win32') {
      expect(rel.replace(/\\/g, '/')).toBe('bin/yt-dlp.exe')
    } else {
      expect(rel).toBe('bin/yt-dlp')
    }
  })

  it('resolveBundledYtdlpPath finds repo resources/bin on Windows', () => {
    if (process.platform !== 'win32') return
    const repoExe = join(process.cwd(), 'resources', 'bin', 'yt-dlp.exe')
    if (!existsSync(repoExe)) return
    expect(resolveBundledYtdlpPath()).toBe(repoExe)
  })
})
