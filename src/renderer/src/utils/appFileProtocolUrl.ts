/** Same scheme as main `modelFileProtocol` — fetchable local files from http://localhost renderer. */
export const APP_FILE_PROTOCOL = 'assetvault-model'

export function fileUrlToPath(fileUrl: string): string {
  const pathname = decodeURIComponent(new URL(fileUrl).pathname).replace(/\\/g, '/')
  if (/^\/[a-zA-Z]:/.test(pathname)) return pathname.slice(1)
  return pathname
}

export function toAppFileProtocolUrl(fileUrl: string): string {
  const path = fileUrlToPath(fileUrl).replace(/\\/g, '/')
  return `${APP_FILE_PROTOCOL}:///${encodeURI(path)}`
}

/** Resolve library-relative or absolute stored path → custom protocol URL for FontFace / fetch. */
export async function resolveLibraryFileProtocolUrl(storedPath: string): Promise<string> {
  const fileUrl = await window.assetVaultAPI.fs.pathToFileUrl(storedPath)
  if (!fileUrl) throw new Error('无法解析字体文件路径')
  return toAppFileProtocolUrl(fileUrl)
}
