import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

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

export function useAiCanvasNavOptional(): AiCanvasNavValue | null {
  return useContext(AiCanvasNavContext)
}

export const AiCanvasNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [screen, setScreen] = useState<AppScreen>('ai-canvas-list')
  const [canvasId, setCanvasId] = useState<string | null>(null)

  const openCanvasList = useCallback(() => {
    setCanvasId(null)
    setScreen('ai-canvas-list')
  }, [])

  const openCanvasEditor = useCallback((id: string) => {
    setCanvasId(id)
    setScreen('ai-canvas-editor')
  }, [])

  /** 独立窗口：聚焦资源库主窗口 */
  const backToLibrary = useCallback(() => {
    void window.assetVaultAPI.window.focusMain()
  }, [])

  const backToCanvasList = useCallback(() => {
    setCanvasId(null)
    setScreen('ai-canvas-list')
  }, [])

  useEffect(() => {
    const unsub = window.assetVaultAPI.assetDrag.onNavigate(({ canvasId: id }) => {
      if (id) openCanvasEditor(id)
      else openCanvasList()
    })
    return unsub
  }, [openCanvasEditor, openCanvasList])

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

/** 主窗口 Toolbar 用：不依赖 NavProvider */
export function openAiCanvasWindow(canvasId?: string | null): void {
  void window.assetVaultAPI.window.openAiCanvas(canvasId ?? null)
}
