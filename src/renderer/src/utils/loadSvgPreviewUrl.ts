/**
 * Load SVG for <img> in sandboxed renderer (file:// is blocked from http://localhost).
 * Caller must revoke the URL when done.
 */
export async function loadSvgPreviewObjectUrl(filePath: string): Promise<string | null> {
  try {
    const bytes = await window.assetVaultAPI.fs.readFileBytes(filePath)
    if (!bytes?.byteLength) return null
    const blob = new Blob([bytes], { type: 'image/svg+xml' })
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

export function revokeSvgPreviewObjectUrl(url: string | null | undefined): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
