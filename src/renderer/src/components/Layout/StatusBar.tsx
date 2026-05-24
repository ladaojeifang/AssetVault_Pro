import React from 'react'
import type { ImportProgress } from '@/shared/types'

interface StatusBarProps {
  isImporting: boolean
  importProgress: ImportProgress | null
}

const StatusBar: React.FC<StatusBarProps> = ({ isImporting, importProgress }) => {
  const [currentTime, setCurrentTime] = React.useState(new Date())

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const progressLabel =
    importProgress && importProgress.total > 0
      ? `导入中 ${importProgress.current}/${importProgress.total} · ${importProgress.filename}`
      : '导入中…'

  return (
    <div className="flex items-center justify-between h-7 px-4 bg-av-bg-secondary border-t border-av-border text-xs text-av-text-muted select-none shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {isImporting && (
          <span className="flex items-center gap-1.5 text-av-accent-orange animate-pulse min-w-0">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
            >
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
            <span className="truncate max-w-[min(520px,50vw)]">{progressLabel}</span>
          </span>
        )}
        <span className="hidden sm:inline shrink-0">AssetVault Pro v0.5 Alpha</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3 shrink-0">
        <span>{currentTime.toLocaleTimeString()}</span>
      </div>
    </div>
  )
}

export default StatusBar
