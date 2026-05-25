import React from 'react'
import { useApp } from '../../stores/AppContext'
import { COLOR_BUCKET_OPTIONS } from '@/shared/colorBucket'
import { DATE_PRESET_OPTIONS, SIZE_PRESET_OPTIONS } from '@/shared/assetFilters'

const AssetFilterBar: React.FC = () => {
  const {
    colorBucketFilter,
    sizePresetFilter,
    datePresetFilter,
    setColorBucketFilter,
    setSizePresetFilter,
    setDatePresetFilter,
    clearAssetFilters
  } = useApp()

  const hasFilters = !!(colorBucketFilter || sizePresetFilter || datePresetFilter)

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-av-border bg-av-bg-secondary shrink-0 flex-wrap">
      <span className="text-[11px] text-av-text-muted shrink-0">筛选</span>

      <div className="flex items-center gap-1" title="主色">
        {COLOR_BUCKET_OPTIONS.map((opt) => {
          const active = colorBucketFilter === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              title={opt.label}
              onClick={() => setColorBucketFilter(active ? null : opt.id)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
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

      <div className="w-px h-5 bg-av-border shrink-0" />

      <select
        value={sizePresetFilter ?? ''}
        onChange={(e) => setSizePresetFilter((e.target.value || null) as typeof sizePresetFilter)}
        className="bg-av-bg-elevated text-av-text-secondary border border-av-border rounded-md px-2 py-0.5 text-[11px] outline-none cursor-pointer focus:border-av-accent-blue"
        title="尺寸"
      >
        <option value="">尺寸</option>
        {SIZE_PRESET_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={datePresetFilter ?? ''}
        onChange={(e) => setDatePresetFilter((e.target.value || null) as typeof datePresetFilter)}
        className="bg-av-bg-elevated text-av-text-secondary border border-av-border rounded-md px-2 py-0.5 text-[11px] outline-none cursor-pointer focus:border-av-accent-blue"
        title="导入日期"
      >
        <option value="">日期</option>
        {DATE_PRESET_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => clearAssetFilters()}
          className="text-[11px] text-av-text-muted hover:text-av-accent-blue transition-colors ml-1"
        >
          清除筛选
        </button>
      ) : null}
    </div>
  )
}

export default AssetFilterBar
