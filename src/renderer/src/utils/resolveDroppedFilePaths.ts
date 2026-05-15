/**
 * Resolve OS paths from a drag/drop FileList (Electron sandbox: use preload webUtils).
 */

function pathFromFileUri(uri: string): string | null {
  try {
    const u = new URL(uri.trim())
    if (u.protocol !== 'file:') return null
    let pathname = decodeURIComponent(u.pathname.replace(/\+/g, ' '))
    if (/^\/[a-zA-Z]:[\\/]/.test(pathname)) pathname = pathname.slice(1)
    return pathname
  } catch {
    return null
  }
}

function pathsFromUriList(dt: DataTransfer): string[] {
  const out: string[] = []
  try {
    const raw = dt.getData('text/uri-list')
    if (!raw) return out
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const p = pathFromFileUri(t)
      if (p) {
        out.push(p)
        continue
      }
      if (/^[a-zA-Z]:[\\/].+/.test(t)) out.push(t)
    }
  } catch {
    /* ignore */
  }
  return out
}

function pathFromPlainTextDrop(dt: DataTransfer): string[] {
  try {
    const plain = dt.getData('text/plain').trim()
    if (/^[a-zA-Z]:[\\/].+/.test(plain)) return [plain]
  } catch {
    /* ignore */
  }
  return []
}

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

/** True if this is an in-app asset drag (should not run OS file import in DropZone). */
export function isInternalAssetVaultDrag(dt: DataTransfer | null): boolean {
  if (!dt?.types) return false
  const types = Array.from(dt.types)
  return (
    types.includes('application/x-assetvault-drag') || types.includes('application/x-assetvault-asset-id')
  )
}

/**
 * Windows / Electron: some drops expose `text/uri-list` or items without a reliable `Files` type.
 */
export function dataTransferMightContainOsFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false
  if (dt.files?.length) return true
  const types = dt.types ? Array.from(dt.types) : []
  if (
    types.some(
      (t) => t === 'Files' || t === 'application/x-moz-file' || t.toLowerCase() === 'files'
    )
  )
    return true
  if (types.includes('text/uri-list')) return true
  if (dt.items && Array.from(dt.items).some((i) => i.kind === 'file')) return true
  return false
}

/**
 * Full resolution for one DataTransfer (Files + items + file:// URI list + plain path).
 */
export function resolveDropPaths(dt: DataTransfer): string[] {
  const out = new Set<string>()
  const add = (p: string | undefined | null) => {
    if (typeof p === 'string' && p.length > 0) out.add(p)
  }

  for (const p of resolveDroppedFilePaths(Array.from(dt.files))) add(p)

  if (dt.items?.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i]
      if (item.kind !== 'file') continue
      const f = item.getAsFile()
      if (f) for (const p of resolveDroppedFilePaths([f])) add(p)
    }
  }

  if (out.size === 0) {
    for (const p of pathsFromUriList(dt)) add(p)
  }
  if (out.size === 0) {
    for (const p of pathFromPlainTextDrop(dt)) add(p)
  }

  return [...out]
}
