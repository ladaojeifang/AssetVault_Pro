import { createContext, useContext } from 'react'

export type ImageNodeAction = {
  uploadToNode: (nodeId: string) => void
  img2imgFromNode: (nodeId: string) => void
  inpaintFromNode: (nodeId: string) => void
}

export const AiCanvasImageActionsContext = createContext<ImageNodeAction>({
  uploadToNode: () => {},
  img2imgFromNode: () => {},
  inpaintFromNode: () => {}
})

export function useAiCanvasImageActions(): ImageNodeAction {
  return useContext(AiCanvasImageActionsContext)
}
