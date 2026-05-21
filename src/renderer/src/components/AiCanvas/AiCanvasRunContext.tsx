import { createContext, useContext } from 'react'

export const AiCanvasRunContext = createContext<(generatorId: string) => void>(() => {})

export function useAiCanvasRun(): (generatorId: string) => void {
  return useContext(AiCanvasRunContext)
}
