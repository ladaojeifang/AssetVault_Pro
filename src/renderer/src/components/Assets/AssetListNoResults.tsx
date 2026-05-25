import React from 'react'

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
      <h3 className="text-base font-semibold text-av-text-primary">没有匹配的资产</h3>
      <p className="text-sm text-av-text-muted mt-1 max-w-sm">
        当前筛选或搜索条件下没有结果，可清除条件或返回上级目录查看全部内容。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        <button type="button" onClick={onClearFilters} className="btn-primary text-xs">
          清除全部筛选
        </button>
        {onBackToParent && parentLabel ? (
          <button type="button" onClick={onBackToParent} className="btn-secondary text-xs">
            返回「{parentLabel}」
          </button>
        ) : null}
      </div>
    </div>
  )
}
