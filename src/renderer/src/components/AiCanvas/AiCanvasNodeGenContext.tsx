import { createContext, useContext } from 'react'

export interface NodeGenActions {
  patchNode: (nodeId: string, patch: Record<string, unknown>) => void
  runNode: (nodeId: string) => void
  translateTextResult: (nodeId: string) => void
  uploadImage: (nodeId: string) => void
  uploadVideo: (nodeId: string) => void
  importImage: (nodeId: string) => void
}

export const AiCanvasNodeGenContext = createContext<NodeGenActions>({
  patchNode: () => {},
  runNode: () => {},
  translateTextResult: () => {},
  uploadImage: () => {},
  uploadVideo: () => {},
  importImage: () => {}
})

export function useNodeGen(): NodeGenActions {
  return useContext(AiCanvasNodeGenContext)
}
