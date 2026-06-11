export type AssetDragPayload = {
  assetIds: string[]
  addToFolderOnly?: boolean
}

export function isAssetDragEvent(e: React.DragEvent | DragEvent): boolean {
  const types = e.dataTransfer?.types
  if (!types) return false
  const list = Array.from(types)
  return (
    list.includes('application/x-assetvault-drag') ||
    list.includes('application/x-assetvault-asset-id')
  )
}

/** Parse asset ids from an in-app asset drag (grid or sidebar). */
export function parseAssetDragPayload(e: React.DragEvent | DragEvent): AssetDragPayload | null {
  const dt = e.dataTransfer
  if (!dt) return null

  let raw = ''
  try {
    raw = dt.getData('application/x-assetvault-drag')
  } catch {
    /* ignore */
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { assetIds?: string[]; addToFolderOnly?: boolean }
      const assetIds = Array.isArray(parsed.assetIds) ? parsed.assetIds.filter(Boolean) : []
      if (assetIds.length > 0) {
        return { assetIds, addToFolderOnly: parsed.addToFolderOnly === true }
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const single = dt.getData('application/x-assetvault-asset-id')
    if (single) return { assetIds: [single] }
  } catch {
    /* ignore */
  }

  return null
}
