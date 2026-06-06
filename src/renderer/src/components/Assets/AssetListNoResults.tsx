import React from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  onClearFilters: () => void
  onBackToParent?: () => void
  parentLabel?: string
}

/** 有筛选/搜索但无匹配资产时的占位（保留工具栏与列表表头） */
export function AssetListNoResults({
  onClearFilters,
  onBackToParent,
  parentLabel
}: Props): React.ReactElement {
  const { t } = useTranslation('assets')
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center min-h-[min(100%,320px)] w-full">
      <div className="w-14 h-14 rounded-xl bg-av-bg-secondary border border-av-border/60 flex items-center justify-center mb-4">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-av-text-muted"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
          <path d="M8 11h6" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-av-text-primary">{t('noMatchTitle')}</h3>
      <p className="text-sm text-av-text-muted mt-1 max-w-sm">{t('noMatchDesc')}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        <button type="button" onClick={onClearFilters} className="btn-primary text-xs">
          {t('clearFilters')}
        </button>
        {onBackToParent && parentLabel ? (
          <button type="button" onClick={onBackToParent} className="btn-secondary text-xs">
            {t('backTo', { name: parentLabel })}
          </button>
        ) : null}
      </div>
    </div>
  )
}
