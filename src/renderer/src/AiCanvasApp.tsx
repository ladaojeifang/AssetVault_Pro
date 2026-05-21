import React, { useState, useEffect } from 'react'
import AiCanvasShell from './components/AiCanvas/AiCanvasShell'
import { AiCanvasNavProvider } from './stores/AiCanvasNavContext'
import SettingsPage from './components/Settings/SettingsPage'
import { useGlobalHotkeys } from './hooks/useHotkeys'

/** AI 画布独立窗口根组件 */
const AiCanvasApp: React.FC = () => {
  const [settingsVisible, setSettingsVisible] = useState(false)

  useEffect(() => {
    const open = () => setSettingsVisible(true)
    window.addEventListener('assetvault:open-settings', open)
    return () => window.removeEventListener('assetvault:open-settings', open)
  }, [])

  useGlobalHotkeys()

  return (
    <AiCanvasNavProvider>
      <AiCanvasShell />
      <SettingsPage visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </AiCanvasNavProvider>
  )
}

export default AiCanvasApp
