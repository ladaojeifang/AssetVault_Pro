import React from 'react'
import AiCanvasShell from './components/AiCanvas/AiCanvasShell'
import { AiCanvasNavProvider } from './stores/AiCanvasNavContext'
import { useGlobalHotkeys } from './hooks/useHotkeys'

/** AI 画布独立窗口根组件 */
const AiCanvasApp: React.FC = () => {
  useGlobalHotkeys()

  return (
    <AiCanvasNavProvider>
      <AiCanvasShell />
    </AiCanvasNavProvider>
  )
}

export default AiCanvasApp
