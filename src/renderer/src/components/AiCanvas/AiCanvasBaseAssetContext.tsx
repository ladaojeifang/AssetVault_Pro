import { createContext, useContext } from 'react'

export interface BaseAssetActions {
  loadLocalImage: (nodeId: string) => Promise<void>
  loadLocalVideo: (nodeId: string) => Promise<void>
}

export const AiCanvasBaseAssetContext = createContext<BaseAssetActions>({
  loadLocalImage: async () => {},
  loadLocalVideo: async () => {}
})

export function useBaseAssetActions(): BaseAssetActions {
  return useContext(AiCanvasBaseAssetContext)
}
