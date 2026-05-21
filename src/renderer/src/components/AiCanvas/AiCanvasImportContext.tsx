import { createContext, useContext } from 'react'

export const AiCanvasImportContext = createContext<(outputNodeId: string) => void>(() => {})

export function useAiCanvasImport(): (outputNodeId: string) => void {
  return useContext(AiCanvasImportContext)
}
