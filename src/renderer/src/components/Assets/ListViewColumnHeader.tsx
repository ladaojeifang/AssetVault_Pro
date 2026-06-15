import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { CategoryItem, SortField, TagItem } from '@/shared/types'

import type { ColorBucket } from '@/shared/colorBucket'

import type { DatePreset, SizePreset } from '@/shared/assetFilters'
import { hasActiveAssetFilters, formatExtensionFilterLabel } from '@/shared/assetFilters'

import { FileSizeFilterControl } from './FileSizeFilterControl'
import { ExtensionFilterControl } from './ExtensionFilterControl'

import { ListColumnResizeHandle } from './ListColumnResizeHandle'
import { getColorBucketOptions } from '../../utils/colorBucketLabels'

import { getTranslatedDatePresetOptions } from '../../utils/assetFilterLabels'

function typeOptionLabel(item: CategoryItem, fileTypeLabel: (id: string) => string): string {
  if (item.kind === 'system' && item.fileType) {
    return fileTypeLabel(item.fileType)
  }
  return item.icon ? `${item.icon} ${item.name}` : item.name
}

function SortCaret({ active, order }: { active: boolean; order: 'asc' | 'desc' }) {
  if (!active) {
    return (
      <span className="inline-flex flex-col opacity-30 leading-none ml-0.5" aria-hidden>
        <span className="text-[6px]">▲</span>
        <span className="text-[6px] -mt-px">▼</span>
      </span>
    )
  }
  return (
    <span className="opacity-90 ml-0.5 text-[9px]" aria-hidden>
      {order === 'asc' ? '▲' : '▼'}
    </span>
  )
}

function SortButton({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
  sortByTitle
}: {
  label: string
  field: SortField
  sortField: SortField
  sortOrder: 'asc' | 'desc'
  onSort: (field: SortField) => void
  sortByTitle: (label: string) => string
}) {
  const active = sortField === field
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="av-list-sort-btn"
      data-active={active}
      title={sortByTitle(label)}
    >
      {label}
      <SortCaret active={active} order={sortOrder} />
    </button>
  )
}

function ListFilterChip({
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
      className="inline-flex items-center gap-1 max-w-[120px] px-1.5 py-0.5 rounded-md text-[10px] text-av-text-secondary bg-av-bg-elevated border border-av-border hover:border-av-accent-blue/50 hover:text-av-text-primary transition-colors"
      title={label}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden />
      <span className="truncate">{label}</span>
      <span className="text-av-text-muted shrink-0 leading-none" aria-hidden>
        ×
      </span>
    </button>
  )
}

function ListHeaderCell({
  columnIndex,
  resizable,
  onResizeColumn,
  onResetColumn,
  children,
  className = ''
}: {
  columnIndex: number
  resizable?: boolean
  onResizeColumn?: (columnIndex: number, e: React.MouseEvent) => void
  onResetColumn?: (columnIndex: number) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`av-list-header__cell group/cell min-w-0 ${className}`}>
      {children}
      {resizable && onResizeColumn ? (
        <ListColumnResizeHandle
          onPointerDown={(e) => onResizeColumn(columnIndex, e)}
          onDoubleClickReset={onResetColumn ? () => onResetColumn(columnIndex) : undefined}
        />
      ) : null}
    </div>
  )
}

type Props = {
  gridTemplateColumns: string
  headerGridClass: string
  layoutStretched?: boolean
  tableMinWidth?: number
  onResizeColumn?: (columnIndex: number, e: React.MouseEvent) => void
  onResetColumn?: (columnIndex: number) => void
  totalAssets: number
  showSectionTitle?: boolean
  contentOpen?: boolean
  onToggleContent?: () => void
  sortField: SortField
  sortOrder: 'asc' | 'desc'
  onSort: (field: SortField) => void
  typeFilter: string | null
  typeOptions: CategoryItem[]
  onTypeFilter: (typeId: string | null) => void
  typeFilters: string[]
  tagFilters: string[]
  tags: TagItem[]
  onRemoveTypeFilter: (id: string) => void
  onRemoveTagFilter: (id: string) => void
  onClearFilters: () => void
  sizePresetFilter: SizePreset | null
  onSizePreset: (preset: SizePreset | null) => void
  fileSizeMinMb: number | null
  fileSizeMaxMb: number | null
  onFileSizeMb: (minMb: number | null, maxMb: number | null) => void
  datePresetFilter: DatePreset | null
  onDatePreset: (preset: DatePreset | null) => void
  extensionFilter: string | null
  onExtensionFilter: (extension: string | null) => void
  colorBucketFilter: ColorBucket | null
  onColorBucket: (bucket: ColorBucket | null) => void
}

export function ListViewColumnHeader({
  gridTemplateColumns,
  headerGridClass,
  layoutStretched = false,
  tableMinWidth,
  onResizeColumn,
  onResetColumn,
  totalAssets,
  showSectionTitle = true,
  contentOpen = true,
  onToggleContent,
  sortField,
  sortOrder,
  onSort,
  typeFilter,
  typeOptions,
  onTypeFilter,
  typeFilters,
  tagFilters,
  tags,
  onRemoveTypeFilter,
  onRemoveTagFilter,
  onClearFilters,
  sizePresetFilter,
  onSizePreset,
  fileSizeMinMb,
  fileSizeMaxMb,
  onFileSizeMb,
  datePresetFilter,
  onDatePreset,
  extensionFilter,
  onExtensionFilter,
  colorBucketFilter,
  onColorBucket
}: Props): React.ReactElement {
  const { t } = useTranslation('assets')
  const datePresetOptions = getTranslatedDatePresetOptions(t)
  const colorBucketOptions = useMemo(() => getColorBucketOptions(t), [t])
  const sortProps = { sortField, sortOrder, onSort, sortByTitle: (label: string) => t('sortBy', { label }) }

  const fileTypeLabel = (id: string) =>
    id === '3d' ? '3D' : t(`fileTypes.${id}` as 'fileTypes.image')

  const categoryById = useMemo(
    () => new Map(typeOptions.map((c) => [c.id, c])),
    [typeOptions]
  )
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])

  const activeTypeItems = useMemo(
    () =>
      typeFilters
        .map((id) => categoryById.get(id))
        .filter((c): c is CategoryItem => Boolean(c)),
    [typeFilters, categoryById]
  )
  const activeTagItems = useMemo(
    () => tagFilters.map((id) => tagById.get(id)).filter((tag): tag is TagItem => Boolean(tag)),
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
  const hasAnyFilters = hasToolbarFilters || hasSidebarFilters

  const gridStyle = { gridTemplateColumns }

  return (
    <div
      className={`av-list-header shrink-0 border-b border-av-border/30 backdrop-blur-md ${
        layoutStretched ? 'w-full' : ''
      }`}
      style={tableMinWidth != null ? { minWidth: tableMinWidth } : undefined}
    >
      {showSectionTitle && onToggleContent && (
        <button
          type="button"
          className="av-list-header__section-btn flex items-center gap-2 w-full text-left text-xs font-medium text-av-text-secondary hover:text-av-text-primary px-4 py-2 border-b border-av-border/20"
          onClick={onToggleContent}
        >
          <span
            className={`inline-flex w-4 h-4 items-center justify-center rounded text-[9px] text-av-text-muted bg-av-bg-elevated/60 transition-transform ${
              contentOpen ? '' : '-rotate-90'
            }`}
          >
            ▼
          </span>
          <span>
            {t('content')}
            <span className="ml-1.5 tabular-nums text-av-text-muted font-normal">
              {totalAssets.toLocaleString()}
            </span>
          </span>
        </button>
      )}

      {contentOpen && (
        <>
          <div
            className={`av-list-header__grid av-list-header__sort-row ${headerGridClass} py-1.5 text-[11px]`}
            style={gridStyle}
            role="row"
          >
            <ListHeaderCell columnIndex={0} resizable onResizeColumn={onResizeColumn} onResetColumn={onResetColumn}>
              <div className="flex items-center justify-center h-6">
                <span className="text-[10px] text-av-text-muted/80 font-medium" aria-hidden>
                  {t('columns.thumb')}
                </span>
              </div>
            </ListHeaderCell>

            <ListHeaderCell columnIndex={1} resizable onResizeColumn={onResizeColumn} onResetColumn={onResetColumn}>
              <div className="flex items-center h-6 min-w-0">
                <SortButton label={t('columns.name')} field="filename" {...sortProps} />
              </div>
            </ListHeaderCell>

            <ListHeaderCell columnIndex={2} resizable onResizeColumn={onResizeColumn} onResetColumn={onResetColumn}>
              <div className="flex items-center h-6 min-w-0">
                <SortButton label={t('columns.size')} field="fileSize" {...sortProps} />
              </div>
            </ListHeaderCell>

            <ListHeaderCell columnIndex={3} resizable onResizeColumn={onResizeColumn} onResetColumn={onResetColumn}>
              <div className="flex items-center h-6 min-w-0">
                <SortButton label={t('columns.type')} field="fileType" {...sortProps} />
              </div>
            </ListHeaderCell>

            <ListHeaderCell columnIndex={4} resizable onResizeColumn={onResizeColumn} onResetColumn={onResetColumn}>
              <div className="flex items-center h-6 min-w-0">
                <SortButton label={t('columns.extension')} field="extension" {...sortProps} />
              </div>
            </ListHeaderCell>

            <ListHeaderCell columnIndex={5} resizable onResizeColumn={onResizeColumn} onResetColumn={onResetColumn}>
              <div className="flex items-center h-6 min-w-0">
                <SortButton label={t('columns.importedAt')} field="importedAt" {...sortProps} />
              </div>
            </ListHeaderCell>

            <ListHeaderCell columnIndex={6}>
              <div className="flex items-center justify-end h-6 min-w-0">
                <SortButton label={t('columns.dominantColor')} field="dominantColor" {...sortProps} />
              </div>
            </ListHeaderCell>
          </div>

          <div
            className={`av-list-header__grid av-list-header__filter-row ${headerGridClass} pb-2 text-[11px]`}
            style={gridStyle}
            role="row"
          >
            <div className="av-list-header__filter-cell" aria-hidden />

            <div className="av-list-header__filter-cell min-w-0">
              <div className="flex items-center gap-1 min-w-0 flex-wrap">
                {hasAnyFilters ? (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md border border-av-border/60 bg-av-bg-elevated/50 text-av-text-muted hover:text-av-accent-blue hover:border-av-accent-blue/40 transition-colors"
                    title={t('clearFilters')}
                    aria-label={t('clearFilters')}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                ) : null}
                {activeTypeItems.map((item) => (
                  <ListFilterChip
                    key={item.id}
                    label={item.icon ? `${item.icon} ${item.name}` : item.name}
                    color={item.color}
                    onRemove={() => onRemoveTypeFilter(item.id)}
                  />
                ))}
                {activeTagItems.map((tag) => (
                  <ListFilterChip
                    key={tag.id}
                    label={tag.name}
                    color={tag.color}
                    onRemove={() => onRemoveTagFilter(tag.id)}
                  />
                ))}
                {extensionFilter ? (
                  <ListFilterChip
                    label={formatExtensionFilterLabel(extensionFilter)}
                    color="#64748b"
                    onRemove={() => onExtensionFilter(null)}
                  />
                ) : null}
              </div>
            </div>

            <div className="av-list-header__filter-cell min-w-0">
              <FileSizeFilterControl
                sizePreset={sizePresetFilter}
                minMb={fileSizeMinMb}
                maxMb={fileSizeMaxMb}
                onPresetChange={onSizePreset}
                onMbChange={onFileSizeMb}
                selectClass="av-list-filter"
                inputClass="av-list-filter-input"
                layout="stack"
                compact
              />
            </div>

            <div className="av-list-header__filter-cell min-w-0">
              <select
                className="av-list-filter"
                value={typeFilter ?? ''}
                onChange={(e) => onTypeFilter(e.target.value || null)}
                title={t('filterByType')}
              >
                <option value="">{t('all')}</option>
                {typeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {typeOptionLabel(item, fileTypeLabel)}
                  </option>
                ))}
              </select>
            </div>

            <div className="av-list-header__filter-cell min-w-0">
              <ExtensionFilterControl
                value={extensionFilter}
                onChange={onExtensionFilter}
              />
            </div>

            <div className="av-list-header__filter-cell min-w-0">
              <select
                className="av-list-filter"
                value={datePresetFilter ?? ''}
                onChange={(e) => onDatePreset((e.target.value || null) as DatePreset | null)}
                title={t('filterByDate')}
              >
                <option value="">{t('all')}</option>
                {datePresetOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="av-list-header__filter-cell min-w-0">
              <div className="av-list-color-row" role="group" aria-label={t('filterBar.dominantColor')}>
                {colorBucketOptions.map((opt) => {
                  const active = colorBucketFilter === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.label}
                      onClick={() => onColorBucket(active ? null : opt.id)}
                      className="av-list-color-swatch"
                      data-active={active}
                      style={{ backgroundColor: opt.hex }}
                      aria-label={opt.label}
                      aria-pressed={active}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
