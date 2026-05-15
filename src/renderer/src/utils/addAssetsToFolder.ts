import { parseAssetDragPayload } from './assetDragDrop'

export async function addDraggedAssetsToFolder(
  e: React.DragEvent,
  folderId: string,
  options?: { requireAlt?: boolean }
): Promise<{ ok: boolean; count: number; skippedAltHint?: boolean }> {
  e.preventDefault()
  e.stopPropagation()

  const payload = parseAssetDragPayload(e)
  if (!payload || payload.assetIds.length === 0) {
    return { ok: false, count: 0 }
  }

  if (options?.requireAlt && !payload.addToFolderOnly) {
    return { ok: false, count: 0, skippedAltHint: true }
  }

  await window.assetVaultAPI.assets.addToFolders(payload.assetIds, [folderId])
  return { ok: true, count: payload.assetIds.length }
}
