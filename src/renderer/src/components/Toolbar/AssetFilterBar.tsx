import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../stores/AppContext'
import { hasActiveAssetFilters } from '@/shared/assetFilters'
import { getTranslatedDatePresetOptions } from '../../utils/assetFilterLabels'
import { getColorBucketOptions } from '../../utils/colorBucketLabels'
import { FileSizeFilterControl } from '../Assets/FileSizeFilterControl'
import { ExtensionFilterControl } from '../Assets/ExtensionFilterControl'
import type { CategoryItem, TagItem } from '@/shared/types'

function SidebarFilterChip({
  label,
  color,
  onRemove
}: {
  label: string
  color: string
  onRemove: () => void
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 max-w-[140px] px-1.5 py-0.5 rounded-md text-[10px] text-av-text-secondary bg-av-bg-elevated border border-av-border hover:border-av-accent-blue/50 hover:text-av-text-primary transition-colors"
      title={label}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
      <span className="text-av-text-muted shrink-0 leading-none" aria-hidden>
        ×
      </span>
    </button>
  )
}

const AssetFilterBar: React.FC = () => {
  const { t } = useTranslation('assets')
  const datePresetOptions = getTranslatedDatePresetOptions(t)
  const colorBucketOptions = useMemo(() => getColorBucketOptions(t), [t])
  const {
    tags,
    categories,
    tagFilters,
    typeFilters,
    colorBucketFilter,
    sizePresetFilter,
    fileSizeMinMb,
    fileSizeMaxMb,
    datePresetFilter,
    extensionFilter,
    setColorBucketFilter,
    setSizePresetFilter,
    setFileSizeMbFilter,
    setDatePresetFilter,
    setExtensionFilter,
    setTagFilters,
    setTypeFilters,
    clearAssetFilters
  } = useApp()

  const categoryById = useMemo(
    () => new Map(categories.map((c: CategoryItem) => [c.id, c])),
    [categories]
  )
  const tagById = useMemo(() => new Map(tags.map((tag: TagItem) => [tag.id, tag])), [tags])

  const activeTypeItems = useMemo(
    () =>
      typeFilters
        .map((id) => categoryById.get(id))
        .filter((c): c is CategoryItem => Boolean(c)),
    [typeFilters, categoryById]
  )
  const activeTagItems = useMemo(
    () =>
      tagFilters.map((id) => tagById.get(id)).filter((tag): tag is TagItem => Boolean(tag)),
    [tagFilters, tagById]
  )

  const hasToolbarFilters = hasActiveAssetFilters({
    colorBucket: colorBucketFilter,
    sizePreset: sizePresetFilter,
    fileSizeMinMb,
    fileSizeMaxMb,
    datePreset: datePresetFilter,
    extension: extensionFilter
  })
  const hasSidebarFilters = typeFilters.length > 0 || tagFilters.length > 0
  const hasFilters = hasToolbarFilters || hasSidebarFilters

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-av-border bg-av-bg-secondary shrink-0 flex-wrap">
      <span className="text-[11px] text-av-text-muted shrink-0">{t('filterBar.label')}</span>

      {activeTypeItems.length > 0 ? (
        <div className="flex items-center gap-1 flex-wrap" title={t('filterBar.activeTypes')}>
          {activeTypeItems.map((item) => (
            <SidebarFilterChip
              key={item.id}
              label={item.icon ? `${item.icon} ${item.name}` : item.name}
              color={item.color}
              onRemove={() => setTypeFilters(typeFilters.filter((id) => id !== item.id))}
            />
          ))}
        </div>
      ) : null}

      {activeTagItems.length > 0 ? (
        <div className="flex items-center gap-1 flex-wrap" title={t('filterBar.activeTags')}>
          {activeTagItems.map((tag) => (
            <SidebarFilterChip
              key={tag.id}
              label={tag.name}
              color={tag.color}
              onRemove={() => setTagFilters(tagFilters.filter((id) => id !== tag.id))}
            />
          ))}
        </div>
      ) : null}

      {hasSidebarFilters ? <div className="w-px h-5 bg-av-border shrink-0" /> : null}

      <div className="flex items-center gap-1" title={t('filterBar.dominantColor')}>
        {colorBucketOptions.map((opt) => {
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

      <FileSizeFilterControl
        sizePreset={sizePresetFilter}
        minMb={fileSizeMinMb}
        maxMb={fileSizeMaxMb}
        onPresetChange={setSizePresetFilter}
        onMbChange={setFileSizeMbFilter}
        selectClass="bg-av-bg-elevated text-av-text-secondary border border-av-border rounded-md px-2 py-0.5 text-[11px] outline-none cursor-pointer focus:border-av-accent-blue min-w-[72px]"
        inputClass="w-14 bg-av-bg-elevated text-av-text-secondary border border-av-border rounded-md px-1.5 py-0.5 text-[11px] outline-none focus:border-av-accent-blue tabular-nums"
        layout="inline"
      />

      <div className="w-px h-5 bg-av-border shrink-0" />

      <div className="min-w-[88px] max-w-[120px]">
        <ExtensionFilterControl
          value={extensionFilter}
          onChange={setExtensionFilter}
          layout="inline"
          selectClass="bg-av-bg-elevated text-av-text-secondary border border-av-border rounded-md px-2 py-0.5 text-[11px] outline-none cursor-pointer focus:border-av-accent-blue w-full"
          inputClass="w-full bg-av-bg-elevated text-av-text-secondary border border-av-border rounded-md px-1.5 py-0.5 text-[11px] outline-none focus:border-av-accent-blue"
        />
      </div>

      <select
        value={datePresetFilter ?? ''}
        onChange={(e) => setDatePresetFilter((e.target.value || null) as typeof datePresetFilter)}
        className="bg-av-bg-elevated text-av-text-secondary border border-av-border rounded-md px-2 py-0.5 text-[11px] outline-none cursor-pointer focus:border-av-accent-blue"
        title={t('filterBar.importDate')}
      >
        <option value="">{t('filterBar.date')}</option>
        {datePresetOptions.map((o) => (
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
          {t('filterBar.clear')}
        </button>
      ) : null}
    </div>
  )
}

export default AssetFilterBar
