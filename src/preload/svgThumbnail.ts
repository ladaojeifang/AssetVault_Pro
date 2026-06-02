import { contextBridge, ipcRenderer } from 'electron'

export type SvgThumbRenderPayload = {
  dataUrl: string
  size: number
  quality: number
}

contextBridge.exposeInMainWorld('svgThumbHost', {
  onRenderRequest: (callback: (payload: SvgThumbRenderPayload) => void) => {
    ipcRenderer.on('svg-thumbnail:render', (_event, payload: SvgThumbRenderPayload) => callback(payload))
  },
  sendResult: (result: { ok: boolean; dataUrl?: string; error?: string; ready?: boolean }) => {
    ipcRenderer.send('svg-thumbnail:result', result)
  }
})
