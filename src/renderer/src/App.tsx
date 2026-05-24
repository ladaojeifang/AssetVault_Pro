import React, { useState, useEffect } from 'react'
import { ConfigProvider } from '@arco-design/web-react'
import Layout from './components/Layout/MainLayout'
import AiCanvasApp from './AiCanvasApp'
import { AppProvider, useApp } from './stores/AppContext'
import { FormatIconOverridesProvider } from './stores/FormatIconOverridesContext'
import { ThemeProvider, useAppTheme } from './stores/ThemeContext'
import { ToastProvider } from './components/Common/Toast'
import DuplicateImportBridge from './components/Import/DuplicateImportBridge'
import DropZone from './components/Common/DropZone'
import SettingsPage from './components/Settings/SettingsPage'
import { useGlobalHotkeys } from './hooks/useHotkeys'

export function isAiCanvasWindowLocation(): boolean {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h === 'ai-canvas' || h.startsWith('ai-canvas/')
}

const MainApp: React.FC = () => {
  const [settingsVisible, setSettingsVisible] = useState(false)
  const { openFontPreview } = useApp()

  useEffect(() => {
    const open = () => setSettingsVisible(true)
    window.addEventListener('assetvault:open-settings', open)
    return () => window.removeEventListener('assetvault:open-settings', open)
  }, [])

  useEffect(() => {
    const unsub = window.assetVaultAPI.fonts.onOpenPreview(({ assetId }) => {
      openFontPreview(assetId)
    })
    return unsub
  }, [openFontPreview])

  useGlobalHotkeys()

  return (
    <>
      <Layout />
      <DropZone />
      <SettingsPage visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </>
  )
}

const ThemedShell: React.FC = () => {
  const { arcoTheme } = useAppTheme()
  const canvasWindow = isAiCanvasWindowLocation()

  return (
    <ConfigProvider theme={arcoTheme}>
      <AppProvider>
        <FormatIconOverridesProvider>
          <ToastProvider>
            <DuplicateImportBridge />
            {canvasWindow ? <AiCanvasApp /> : <MainApp />}
          </ToastProvider>
        </FormatIconOverridesProvider>
      </AppProvider>
    </ConfigProvider>
  )
}

const App: React.FC = () => (
  <ThemeProvider>
    <ThemedShell />
  </ThemeProvider>
)

export default App
