import React, { useState, useEffect } from 'react'
import { useApp } from '../../stores/AppContext'

const TitleBar: React.FC = () => {
  const { sidebarOpen, toggleSidebar } = useApp()
  const [isMaximized, setIsMaximized] = useState(false)
  const [isWinFocused, setIsWinFocused] = useState(true)

  useEffect(() => {
    checkMaximized()
    // Listen for focus/blur
    window.addEventListener('focus', () => setIsWinFocused(true))
    window.addEventListener('blur', () => setIsWinFocused(false))
  }, [])

  async function checkMaximized() {
    try {
      const maxed = await window.electron?.ipcRenderer?.invoke('window:is-maximized')
      setIsMaximized(maxed as boolean)
    } catch {
      // ignore
    }
  }

  async function handleMinimize() {
    await window.assetVaultAPI.window.minimize()
  }

  async function handleMaximize() {
    await window.assetVaultAPI.window.maximize()
    await checkMaximized()
  }

  async function handleClose() {
    await window.assetVaultAPI.window.close()
  }

  return (
    <div className="titlebar-drag flex items-center justify-between h-9 px-3 bg-av-bg-secondary border-b border-av-border select-none shrink-0">
      {/* Left section */}
      <div className="flex items-center gap-2 titlebar-no-drag">
        <button onClick={toggleSidebar} className="btn-icon" title="Toggle Sidebar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={sidebarOpen ? 'M4 6h16M4 12h16M4 18h16' : 'M4 6h11M4 12h13M4 18h9'} />
          </svg>
        </button>

        <div className="flex items-center gap-1.5 ml-1">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-av-accent-blue to-av-accent-purple flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">AV</span>
          </div>
          <span className="text-sm font-semibold text-av-text-primary tracking-tight">
            AssetVault Pro
          </span>
          <span className="text-[10px] text-av-text-muted bg-av-bg-elevated px-1.5 py-0.5 rounded-full ml-1">
            Alpha
          </span>
        </div>
      </div>

      {/* Center - spacer for drag area */}
      <div className="flex-1" />

      {/* Right - Window controls */}
      <div className="flex items-center titlebar-no-drag -mr-2">
        <button
          onClick={handleMinimize}
          className="w-[46px] h-[32px] flex items-center justify-center hover:bg-av-bg-hover transition-colors"
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor" opacity="0.7">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={handleMaximize}
          className={`w-[46px] h-[32px] flex items-center justify-center transition-colors ${
            isMaximized ? 'bg-av-bg-hover' : 'hover:bg-av-bg-hover'
          }`}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.7">
              <rect x="2" y="0" width="8" height="8" />
              <path d="M0 2h8v8" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.7">
              <rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1" />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-[46px] h-[32px] flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.8">
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar
