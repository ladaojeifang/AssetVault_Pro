import React, { useEffect } from 'react'
import Sidebar from '../Sidebar/Sidebar'
import Toolbar from '../Toolbar/Toolbar'
import AssetGrid from '../Assets/AssetGrid'
import DetailPanel from '../Detail/DetailPanel'
import StatusBar from './StatusBar'
import { useApp } from '../../stores/AppContext'

/** 资源库主区域（无 TitleBar），可与 AI 画布并排显示 */
const LibraryPane: React.FC = () => {
  const {
    sidebarOpen,
    detailPanelOpen,
    refreshFolders,
    refreshAssets,
    isImporting
  } = useApp()

  useEffect(() => {
    refreshFolders()
    refreshAssets()
  }, [])

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-av-bg-primary">
      <Toolbar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {sidebarOpen && (
          <div className="w-[192px] min-w-[160px] border-r border-av-border flex-shrink-0 av-sidebar-zoom">
            <Sidebar />
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AssetGrid />
        </div>
        {detailPanelOpen && (
          <div className="w-[280px] min-w-[240px] max-w-[360px] border-l border-av-border flex-shrink-0 overflow-y-auto">
            <DetailPanel />
          </div>
        )}
      </div>
      <StatusBar isImporting={isImporting} />
    </div>
  )
}

export default LibraryPane
