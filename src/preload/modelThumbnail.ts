import { contextBridge, ipcRenderer } from 'electron'

/** Same FS bridge as main renderer so loadModel can fall back when protocol fetch fails. */
const fsBridge = {
  readFileBytes: (filePath: string) =>
    ipcRenderer.invoke('fs:read-file-bytes', filePath) as Promise<Uint8Array>,
  pathToFileUrl: (filePath: string) =>
    ipcRenderer.invoke('fs:path-to-file-url', filePath) as Promise<string | null>
}

contextBridge.exposeInMainWorld('assetVaultAPI', { fs: fsBridge })

contextBridge.exposeInMainWorld('modelThumbHost', {
  onRenderRequest: (
    callback: (payload: { fileUrl: string; ext: string; size: number; libraryPath?: string }) => void
  ) => {
    ipcRenderer.on('model-thumbnail:render', (_event, payload) => callback(payload))
  },
  sendResult: (result: { ok: boolean; dataUrl?: string; error?: string; ready?: boolean }) => {
    ipcRenderer.send('model-thumbnail:result', result)
  }
})
