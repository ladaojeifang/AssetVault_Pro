import React, { useEffect, useRef } from 'react'
import TitleBar from './TitleBar'
import Sidebar from '../Sidebar/Sidebar'
import Toolbar from '../Toolbar/Toolbar'
import AssetGrid from '../Assets/AssetGrid'
import DetailPanel from '../Detail/DetailPanel'
import StatusBar from './StatusBar'
import { useApp } from '../../stores/AppContext'

const MainLayout: React.FC = () => {
  const {
    sidebarOpen,
    detailPanelOpen,
    refreshFolders,
    refreshAssets,
    isImporting
  } = useApp()

  // Initialize data on mount (tags load after assets:query via refreshAssets)
  useEffect(() => {
    refreshFolders()
    refreshAssets()
  }, [])

  return (
    <div className="flex flex-col h-screen w-full bg-av-bg-primary overflow-hidden">
      {/* Title Bar (custom frameless window) */}
      <TitleBar />

      {/* Toolbar */}
      <Toolbar />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: zoom 1.25 scales type/icons; width 192×1.25≈240px layout footprint */}
        {sidebarOpen && (
          <div className="w-[192px] min-w-[160px] border-r border-av-border flex-shrink-0 av-sidebar-zoom">
            <Sidebar />
          </div>
        )}

        {/* Center - Asset Grid/List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AssetGrid />
        </div>

        {/* Detail Panel - Right */}
        {detailPanelOpen && (
          <div className="w-[320px] min-w-[280px] max-w-[400px] border-l border-av-border flex-shrink-0 overflow-y-auto">
            <DetailPanel />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar isImporting={isImporting} />
    </div>
  )
}

export default MainLayout
