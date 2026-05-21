import type { AssetItem } from '@/shared/types'
import { notify } from '../components/Common/notify'
import { resolveAssetPreviewUrl } from './canvasAssetNodes'

export const IMAGE_IMPORT_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] }
]

export const VIDEO_IMPORT_FILTERS = [
  { name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'] }
]

/** 选文件 → 导入素材库 → 返回库内资产记录 */
export async function pickAndImportLibraryAsset(
  kind: 'image' | 'video'
): Promise<AssetItem | null> {
  const filters = kind === 'video' ? VIDEO_IMPORT_FILTERS : IMAGE_IMPORT_FILTERS
  const paths = await window.assetVaultAPI.fs.selectDialog({ multi: false, filters })
  if (!paths.length) return null

  const imported = await window.assetVaultAPI.assets.import(paths)
  const assetId = imported[0]
  if (!assetId) return null

  const asset = (await window.assetVaultAPI.assets.getById(assetId)) as AssetItem | null
  if (!asset) return null

  if (kind === 'video' && asset.fileType !== 'video') {
    notify.warning('请选择视频文件')
    return null
  }
  if (kind === 'image' && asset.fileType !== 'image') {
    notify.warning('请选择图片文件')
    return null
  }

  return asset
}

export async function assetToNodePreview(asset: AssetItem): Promise<string | null> {
  return resolveAssetPreviewUrl(asset)
}
