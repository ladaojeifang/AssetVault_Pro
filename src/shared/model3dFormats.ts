/** Supported 3D formats for preview / thumbnail (P0). */
export const MODEL3D_PREVIEW_EXTENSIONS = new Set([
  '.glb',
  '.gltf',
  '.obj',
  '.stl',
  '.fbx'
])

export type Model3dFormat = 'glb' | 'gltf' | 'obj' | 'stl' | 'fbx'

export function parseModel3dFormat(ext: string): Model3dFormat | null {
  const e = ext.toLowerCase().replace(/^\./, '')
  if (e === 'glb' || e === 'gltf' || e === 'obj' || e === 'stl' || e === 'fbx') {
    return e
  }
  return null
}

export function isModel3dPreviewExtension(ext: string): boolean {
  const dot = ext.startsWith('.') ? ext : `.${ext}`
  return MODEL3D_PREVIEW_EXTENSIONS.has(dot.toLowerCase())
}
