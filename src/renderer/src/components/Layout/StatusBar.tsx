import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportProgress } from '@/shared/types'
import { useApp } from '../../stores/AppContext'
import { getColorBucketOptions } from '../../utils/colorBucketLabels'

interface StatusBarProps {
  isImporting: boolean
  importProgress: ImportProgress | null
}

const StatusBar: React.FC<StatusBarProps> = ({ isImporting, importProgress }) => {
  const { t } = useTranslation(['layout', 'common'])
  const { t: tAssets } = useTranslation('assets')
  const colorBucketOptions = useMemo(() => getColorBucketOptions(tAssets), [tAssets])
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
    modelPreviewAssetId,
    svgPreviewAssetId,
    exrPreviewAssetId,
    markdownPreviewAssetId
  } = useApp()

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const progressLabel =
    importProgress && importProgress.total > 0
      ? t('layout:importingProgress', {
          current: importProgress.current,
          total: importProgress.total,
          filename: importProgress.filename
        })
      : t('layout:importing')

  const inAssetBrowse =
    !fontPreviewAssetId &&
    !modelPreviewAssetId &&
    !svgPreviewAssetId &&
    !exrPreviewAssetId &&
    !markdownPreviewAssetId

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
            {t('layout:assetsTotal', { count: totalAssets.toLocaleString() })}
            {assets.length < totalAssets && (
              <span className="text-av-text-secondary">
                {' '}
                {t('layout:assetsInView', { count: assets.length.toLocaleString() })}
              </span>
            )}
            {selectedAssetIds.size > 0 &&
              ` ${t('layout:selectedCount', { count: selectedAssetIds.size })}`}
            {assets.length > 1 && (
              <span className="text-av-text-muted/80 hidden lg:inline">
                {' '}
                {t('layout:browseHints')}
              </span>
            )}
            {viewMode === 'grid' && assets.length > 0 && (
              <span className="text-av-text-muted/80 hidden md:inline">
                {' '}
                · {t('layout:gridMasonry')}
              </span>
            )}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {inAssetBrowse && viewMode === 'grid' && (
          <div className="flex items-center gap-0.5">
            {colorBucketOptions.map((opt) => {
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
          <span className="text-av-accent-blue whitespace-nowrap">{t('layout:loadingMore')}</span>
        )}
        {inAssetBrowse && isLoading && assets.length > 0 && (
          <span className="whitespace-nowrap">{t('layout:updating')}</span>
        )}
        <span className="tabular-nums whitespace-nowrap hidden sm:inline">
          {t('common:appName')} v0.5 {t('common:alpha')}
        </span>
        <span className="tabular-nums whitespace-nowrap">{currentTime.toLocaleTimeString()}</span>
      </div>
    </div>
  )
}

export default StatusBar
