import React from 'react'

interface StatusBarProps {
  isImporting: boolean
}

const StatusBar: React.FC<StatusBarProps> = ({ isImporting }) => {
  const [currentTime, setCurrentTime] = React.useState(new Date())

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center justify-between h-7 px-4 bg-av-bg-secondary border-t border-av-border text-xs text-av-text-muted select-none shrink-0">
      {/* Left - Status */}
      <div className="flex items-center gap-3">
        {isImporting && (
          <span className="flex items-center gap-1.5 text-av-accent-orange animate-pulse">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
            Importing...
          </span>
        )}
        <span className="hidden sm:inline">AssetVault Pro v0.5 Alpha</span>
      </div>

      {/* Center - Spacer */}
      <div className="flex-1" />

      {/* Right - Time & info */}
      <div className="flex items-center gap-3">
        <span>{currentTime.toLocaleTimeString()}</span>
      </div>
    </div>
  )
}

export default StatusBar
