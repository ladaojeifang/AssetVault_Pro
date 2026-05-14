/**
 * Resolve OS paths from a drag/drop FileList (Electron sandbox: use preload webUtils).
 */
export function resolveDroppedFilePaths(files: File[]): string[] {
  const out: string[] = []
  for (const f of files) {
    const legacy = (f as File & { path?: string }).path
    if (typeof legacy === 'string' && legacy.length > 0) {
      out.push(legacy)
      continue
    }
    try {
      const p = window.assetVaultAPI.fs.getPathForFile(f)
      if (typeof p === 'string' && p.length > 0) out.push(p)
    } catch {
      // no path available for this entry
    }
  }
  return out
}
