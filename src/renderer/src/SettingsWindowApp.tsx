import React from 'react'
import SettingsPage from './components/Settings/SettingsPage'
import { FormatIconOverridesProvider } from './stores/FormatIconOverridesContext'
import { ToastProvider } from './components/Common/Toast'

/** 设置独立窗口根组件 */
const SettingsWindowApp: React.FC = () => {
  return (
    <FormatIconOverridesProvider>
      <ToastProvider>
        <SettingsPage onClose={() => void window.assetVaultAPI.window.close()} />
      </ToastProvider>
    </FormatIconOverridesProvider>
  )
}

export default SettingsWindowApp
