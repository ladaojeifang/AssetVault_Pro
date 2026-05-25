import React from 'react'
import type { ImportProgress } from '@/shared/types'
import { COLOR_BUCKET_OPTIONS } from '@/shared/colorBucket'
import { useApp } from '../../stores/AppContext'

interface StatusBarProps {
  isImporting: boolean
  importProgress: ImportProgress | null
}

const StatusBar: React.FC<StatusBarProps> = ({ isImporting, importProgress }) => {
  const [currentTime, setCurrentTime] = React.useState(new Date())
  const {
    assets,
    totalAssets,
    selectedAssetIds,
    viewMode,
    isLoading,
    isLoadingMore,
    colorBucketFilter,
    setColorBucketFilter,
    fontPreviewAssetId,
    modelPreviewAssetId
  } = useApp()

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const progressLabel =
    importProgress && importProgress.total > 0
      ? `导入中 ${importProgress.current}/${importProgress.total} · ${importProgress.filename}`
      : '导入中…'

  const inAssetBrowse = !fontPreviewAssetId && !modelPreviewAssetId

  return (
    <div className="flex items-center gap-3 h-7 px-4 bg-av-bg-secondary border-t border-av-border text-xs text-av-text-muted select-none shrink-0 min-w-0">
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
        {isImporting ? (
          <span className="flex items-center gap-1.5 text-av-accent-orange animate-pulse min-w-0 shrink-0">
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
            <span className="truncate max-w-[min(360px,40vw)]">{progressLabel}</span>
          </span>
        ) : null}

        {inAssetBrowse ? (
          <span className="truncate min-w-0">
            {totalAssets.toLocaleString()} assets
            {assets.length < totalAssets && (
              <span className="text-av-text-secondary">
                {' '}
                · {assets.length.toLocaleString()} in view
              </span>
            )}
            {selectedAssetIds.size > 0 && ` · ${selectedAssetIds.size} selected`}
            {assets.length > 1 && (
              <span className="text-av-text-muted/80 hidden lg:inline">
                {' '}
                · Ctrl/⌘+滚轮缩放 · Ctrl/⌘+单击多选 · Shift+单击范围 · 拖到上方子文件夹加入目录
              </span>
            )}
            {viewMode === 'grid' && assets.length > 0 && (
              <span className="text-av-text-muted/80 hidden md:inline"> · 瀑布流</span>
            )}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {inAssetBrowse && viewMode === 'grid' && (
          <div className="flex items-center gap-0.5">
            {COLOR_BUCKET_OPTIONS.map((opt) => {
              const active = colorBucketFilter === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.label}
                  onClick={() => setColorBucketFilter(active ? null : opt.id)}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-transform ${
                    active
                      ? 'border-av-accent-blue scale-110 ring-1 ring-av-accent-blue/40'
                      : 'border-av-border hover:border-av-text-muted'
                  }`}
                  style={{ backgroundColor: opt.hex }}
                  aria-label={opt.label}
                  aria-pressed={active}
                />
              )
            })}
          </div>
        )}
        {inAssetBrowse && isLoadingMore && (
          <span className="text-av-accent-blue whitespace-nowrap">Loading more…</span>
        )}
        {inAssetBrowse && isLoading && assets.length > 0 && (
          <span className="whitespace-nowrap">Updating…</span>
        )}
        <span className="tabular-nums whitespace-nowrap hidden sm:inline">
          AssetVault Pro v0.5 Alpha
        </span>
        <span className="tabular-nums whitespace-nowrap">{currentTime.toLocaleTimeString()}</span>
      </div>
    </div>
  )
}

export default StatusBar
