import { renderModelSnapshot } from './utils/model3d/loadModel'

declare global {
  interface Window {
    __assetVaultRenderModelSnapshot?: (
      libraryPath: string,
      ext: string,
      size: number
    ) => Promise<string>
  }
}

/** Called from main process via executeJavaScript — same load path as ModelViewer preview. */
window.__assetVaultRenderModelSnapshot = async (libraryPath, ext, size) => {
  try {
    const fileUrl = await window.assetVaultAPI.fs.pathToFileUrl(libraryPath)
    if (!fileUrl) throw new Error('无法解析模型路径')
    return await renderModelSnapshot(fileUrl, ext, size, undefined, libraryPath)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ModelSnapshot] failed:', libraryPath, msg)
    throw err
  }
}
