import React from 'react'
import TitleBar from '../Layout/TitleBar'
import { useAiCanvasNav } from '../../stores/AiCanvasNavContext'
import AiCanvasListPage from './AiCanvasListPage'
import AiCanvasEditor from './AiCanvasEditor'

const AiCanvasShell: React.FC = () => {
  const { screen, canvasId } = useAiCanvasNav()

  return (
    <div className="flex flex-col h-screen w-full bg-av-bg-primary overflow-hidden">
      <TitleBar />
      {screen === 'ai-canvas-list' && <AiCanvasListPage />}
      {screen === 'ai-canvas-editor' && canvasId && <AiCanvasEditor canvasId={canvasId} />}
    </div>
  )
}

export default AiCanvasShell
