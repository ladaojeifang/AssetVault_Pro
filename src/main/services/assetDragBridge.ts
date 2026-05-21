/** 跨窗口素材拖放：主窗口 dragstart 写入，画布窗口 drop 读取 */

let activeAssetIds: string[] | null = null

export function setCrossWindowAssetDrag(assetIds: string[]): void {
  activeAssetIds = assetIds.length > 0 ? [...assetIds] : null
}

export function peekCrossWindowAssetDrag(): string[] | null {
  return activeAssetIds ? [...activeAssetIds] : null
}

export function consumeCrossWindowAssetDrag(): string[] | null {
  const ids = activeAssetIds
  activeAssetIds = null
  return ids ? [...ids] : null
}

export function clearCrossWindowAssetDrag(): void {
  activeAssetIds = null
}

export function isCrossWindowAssetDragActive(): boolean {
  return activeAssetIds != null && activeAssetIds.length > 0
}
