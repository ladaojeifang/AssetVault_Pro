import React, { useEffect } from 'react'
import { ConfigProvider } from '@arco-design/web-react'
import Layout from './components/Layout/MainLayout'
import AiCanvasApp from './AiCanvasApp'
import SettingsWindowApp from './SettingsWindowApp'
import { AppProvider, useApp } from './stores/AppContext'
import { FormatIconOverridesProvider } from './stores/FormatIconOverridesContext'
import { ThemeProvider, useAppTheme } from './stores/ThemeContext'
import { LocaleProvider, useAppLocale } from './stores/LocaleContext'
import { ToastProvider } from './components/Common/Toast'
import DuplicateImportBridge from './components/Import/DuplicateImportBridge'
import DropZone from './components/Common/DropZone'
import { useGlobalHotkeys } from './hooks/useHotkeys'

export function isAiCanvasWindowLocation(): boolean {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h === 'ai-canvas' || h.startsWith('ai-canvas/')
}

export function isSettingsWindowLocation(): boolean {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h === 'settings' || h.startsWith('settings/')
}

const MainApp: React.FC = () => {
  const { openFontPreview } = useApp()

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
    </>
  )
}

const ThemedShell: React.FC = () => {
  const { arcoTheme } = useAppTheme()
  const { arcoLocale } = useAppLocale()
  const canvasWindow = isAiCanvasWindowLocation()
  const settingsWindow = isSettingsWindowLocation()

  return (
    <ConfigProvider theme={arcoTheme} locale={arcoLocale}>
      <AppProvider>
        <FormatIconOverridesProvider>
          <ToastProvider>
            <DuplicateImportBridge />
            {settingsWindow ? (
              <SettingsWindowApp />
            ) : canvasWindow ? (
              <AiCanvasApp />
            ) : (
              <MainApp />
            )}
          </ToastProvider>
        </FormatIconOverridesProvider>
      </AppProvider>
    </ConfigProvider>
  )
}

const App: React.FC = () => (
  <ThemeProvider>
    <LocaleProvider>
      <ThemedShell />
    </LocaleProvider>
  </ThemeProvider>
)

export default App
