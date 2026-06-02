/** OpenEXR (.exr) asset helpers (shared by main + renderer). */

export function isExrExtension(ext: string): boolean {
  return ext.replace(/^\./, '').toLowerCase().trim() === 'exr'
}

export function isExrFilePath(filePath: string): boolean {
  const i = filePath.lastIndexOf('.')
  if (i < 0) return false
  return isExrExtension(filePath.slice(i))
}
