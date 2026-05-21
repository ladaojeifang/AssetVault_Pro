import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type AppScreen = 'library' | 'ai-canvas-list' | 'ai-canvas-editor'

interface AiCanvasNavValue {
  screen: AppScreen
  canvasId: string | null
  openCanvasList: () => void
  openCanvasEditor: (id: string) => void
  backToLibrary: () => void
  backToCanvasList: () => void
}

const AiCanvasNavContext = createContext<AiCanvasNavValue | null>(null)

export const AiCanvasNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [screen, setScreen] = useState<AppScreen>('library')
  const [canvasId, setCanvasId] = useState<string | null>(null)

  const openCanvasList = useCallback(() => {
    setCanvasId(null)
    setScreen('ai-canvas-list')
  }, [])

  const openCanvasEditor = useCallback((id: string) => {
    setCanvasId(id)
    setScreen('ai-canvas-editor')
  }, [])

  const backToLibrary = useCallback(() => {
    setCanvasId(null)
    setScreen('library')
  }, [])

  const backToCanvasList = useCallback(() => {
    setCanvasId(null)
    setScreen('ai-canvas-list')
  }, [])

  const value = useMemo(
    () => ({
      screen,
      canvasId,
      openCanvasList,
      openCanvasEditor,
      backToLibrary,
      backToCanvasList
    }),
    [screen, canvasId, openCanvasList, openCanvasEditor, backToLibrary, backToCanvasList]
  )

  return <AiCanvasNavContext.Provider value={value}>{children}</AiCanvasNavContext.Provider>
}

export function useAiCanvasNav(): AiCanvasNavValue {
  const ctx = useContext(AiCanvasNavContext)
  if (!ctx) throw new Error('useAiCanvasNav must be used within AiCanvasNavProvider')
  return ctx
}
