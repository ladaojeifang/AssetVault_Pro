import React from 'react'
import TitleBar from './TitleBar'
import LibraryPane from './LibraryPane'

const MainLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-full bg-av-bg-primary overflow-hidden">
      <TitleBar />
      <LibraryPane />
    </div>
  )
}

export default MainLayout
