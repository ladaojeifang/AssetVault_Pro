/** Supported 3D formats for preview / thumbnail. */
export const MODEL3D_PREVIEW_EXTENSIONS = new Set([
  '.glb',
  '.gltf',
  '.obj',
  '.stl',
  '.ply',
  '.fbx'
])

/** Import as `fileType=3d` but no in-app 3D preview or auto thumbnail. */
export const MODEL3D_IMPORT_ONLY_EXTENSIONS = new Set([
  '.abc',
  '.ma',
  '.mb',
  '.max',
  '.c4d',
  '.hip',
  '.usd',
  '.usda',
  '.usdz',
  '.blend'
])

/** All extensions classified as 3D assets in the library. */
export const MODEL3D_ALL_EXTENSIONS = new Set([
  ...MODEL3D_PREVIEW_EXTENSIONS,
  ...MODEL3D_IMPORT_ONLY_EXTENSIONS
])

export type Model3dFormat = 'glb' | 'gltf' | 'obj' | 'stl' | 'ply' | 'fbx'

/** Formats that may embed skeletal / keyframe animations. */
export const MODEL3D_ANIMATION_FORMATS = new Set<Model3dFormat>(['glb', 'gltf', 'fbx'])

export interface ModelAnimationClipInfo {
  name: string
  durationSeconds: number
}

export function isModel3dAnimationCapableFormat(ext: string): boolean {
  const f = parseModel3dFormat(ext)
  return f !== null && MODEL3D_ANIMATION_FORMATS.has(f)
}

export interface ModelRegenerateFailure {
  assetId: string
  filename: string
  reason: string
}

export interface ModelRegenerateResult {
  scanned: number
  updated: number
  skipped: number
  errors: number
  failures: ModelRegenerateFailure[]
}

export function parseModel3dFormat(ext: string): Model3dFormat | null {
  const e = ext.toLowerCase().replace(/^\./, '')
  if (e === 'glb' || e === 'gltf' || e === 'obj' || e === 'stl' || e === 'ply' || e === 'fbx') {
    return e
  }
  return null
}

export function isModel3dAssetExtension(ext: string): boolean {
  const dot = ext.startsWith('.') ? ext : `.${ext}`
  return MODEL3D_ALL_EXTENSIONS.has(dot.toLowerCase())
}

export function isModel3dPreviewExtension(ext: string): boolean {
  const dot = ext.startsWith('.') ? ext : `.${ext}`
  return MODEL3D_PREVIEW_EXTENSIONS.has(dot.toLowerCase())
}
