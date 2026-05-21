import React, { useState, useEffect } from 'react'
import { ConfigProvider } from '@arco-design/web-react'
import Layout from './components/Layout/MainLayout'
import AiCanvasShell from './components/AiCanvas/AiCanvasShell'
import { AppProvider } from './stores/AppContext'
import { AiCanvasNavProvider, useAiCanvasNav } from './stores/AiCanvasNavContext'
import { ToastProvider } from './components/Common/Toast'
import DropZone from './components/Common/DropZone'
import SettingsPage from './components/Settings/SettingsPage'
import { useGlobalHotkeys } from './hooks/useHotkeys'

// Arco Design theme overrides for dark mode
const arcoTheme = {
  colorPrimary: '#3B82F6',
  colorBgLayout: '#0F1117',
  colorBgContainer: '#161822',
  colorBgElevated: '#252837',
  colorText: '#F1F5F9',
  colorTextSecondary: '#94A3B8',
  colorBorder: '#2D3044',
  borderRadiusMedium: '6px'
}

const AppInner: React.FC = () => {
  const { screen } = useAiCanvasNav()
  const [settingsVisible, setSettingsVisible] = useState(false)

  useEffect(() => {
    const open = () => setSettingsVisible(true)
    window.addEventListener('assetvault:open-settings', open)
    return () => window.removeEventListener('assetvault:open-settings', open)
  }, [])

  // Register global keyboard shortcuts
  useGlobalHotkeys()

  const inLibrary = screen === 'library'

  return (
    <>
      {inLibrary ? <Layout /> : <AiCanvasShell />}
      {inLibrary && <DropZone />}
      <SettingsPage visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </>
  )
}

const App: React.FC = () => {
  return (
    <ConfigProvider theme={arcoTheme}>
      <AppProvider>
        <AiCanvasNavProvider>
          <ToastProvider>
            <AppInner />
          </ToastProvider>
        </AiCanvasNavProvider>
      </AppProvider>
    </ConfigProvider>
  )
}

export default App
