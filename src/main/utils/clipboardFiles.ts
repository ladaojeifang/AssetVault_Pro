import { spawnSync } from 'child_process'

/** Copy absolute file paths to the OS clipboard (paste as files in Explorer/Finder). */
export function copyFilesToSystemClipboard(paths: string[]): boolean {
  const unique = [...new Set(paths.filter((p) => p && p.length > 0))]
  if (unique.length === 0) return false

  if (process.platform === 'win32') {
    const quoted = unique.map((p) => `'${p.replace(/'/g, "''")}'`).join(',')
    const r = spawnSync(
      'powershell',
      ['-NoProfile', '-Command', `Set-Clipboard -Path ${quoted}`],
      { windowsHide: true, timeout: 15000 }
    )
    return r.status === 0
  }

  if (process.platform === 'darwin') {
    const lines = unique.map((p) => `POSIX file "${p.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(', ')
    const script = `set the clipboard to {${lines}}`
    const r = spawnSync('osascript', ['-e', script], { timeout: 15000 })
    return r.status === 0
  }

  const r = spawnSync('xclip', ['-selection', 'clipboard', '-t', 'text/uri-list'], {
    input: unique.map((p) => `file://${p}`).join('\n'),
    timeout: 15000
  })
  return r.status === 0
}
