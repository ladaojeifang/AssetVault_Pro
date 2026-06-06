import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { FileType, SortField } from '@/shared/types'

import type { ColorBucket } from '@/shared/colorBucket'

import type { DatePreset, SizePreset } from '@/shared/assetFilters'

import { FileSizeFilterControl } from './FileSizeFilterControl'

import { ListColumnResizeHandle } from './ListColumnResizeHandle'
import { getColorBucketOptions } from '../../utils/colorBucketLabels'

import { getTranslatedDatePresetOptions } from '../../utils/assetFilterLabels'

const FILE_TYPE_IDS: ReadonlyArray<FileType | '3d'> = [
  'image',
  'video',
  'audio',
  'font',
  'design',
  'document',
  '3d',
  'code',
  'other'
]

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

/** 统一两行：标题行 + 筛选行（无筛选也占位，保证各列对齐） */
function HeaderColumn({
  sort,
  filter,
  align = 'start'
}: {
  sort: React.ReactNode
  filter?: React.ReactNode
  align?: 'start' | 'end' | 'center'
}) {
  const titleAlign =
    align === 'end' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  const filterAlign =
    align === 'end' ? 'items-end' : align === 'center' ? 'items-center' : 'items-start'

  return (
    <div className="flex flex-col min-w-0 w-full h-full">
      <div className={`h-6 flex items-center shrink-0 ${titleAlign}`}>{sort}</div>
      <div className={`min-h-[28px] pt-1 flex flex-col ${filterAlign} w-full`}>
        {filter ?? <span className="block h-6 w-full" aria-hidden />}
      </div>
    </div>
  )
}

function ListHeaderCell({
  columnIndex,
  resizable,
  onResizeColumn,
  onResetColumn,
  children
}: {
  columnIndex: number
  resizable?: boolean
  onResizeColumn?: (columnIndex: number, e: React.MouseEvent) => void
  onResetColumn?: (columnIndex: number) => void
  children: React.ReactNode
}) {
  return (
    <div className="av-list-header__cell group/cell min-w-0 h-full">
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
  fileTypeFilter: string | null
  onFileTypeFilter: (type: string | null) => void
  sizePresetFilter: SizePreset | null
  onSizePreset: (preset: SizePreset | null) => void
  fileSizeMinMb: number | null
  fileSizeMaxMb: number | null
  onFileSizeMb: (minMb: number | null, maxMb: number | null) => void
  datePresetFilter: DatePreset | null
  onDatePreset: (preset: DatePreset | null) => void
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
  fileTypeFilter,
  onFileTypeFilter,
  sizePresetFilter,
  onSizePreset,
  fileSizeMinMb,
  fileSizeMaxMb,
  onFileSizeMb,
  datePresetFilter,
  onDatePreset,
  colorBucketFilter,
  onColorBucket
}: Props): React.ReactElement {
  const { t } = useTranslation('assets')
  const datePresetOptions = getTranslatedDatePresetOptions(t)
  const colorBucketOptions = useMemo(() => getColorBucketOptions(t), [t])
  const sortProps = { sortField, sortOrder, onSort, sortByTitle: (label: string) => t('sortBy', { label }) }

  const fileTypeLabel = (id: string) =>
    id === '3d' ? '3D' : t(`fileTypes.${id}` as 'fileTypes.image')

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
        <div
          className={`av-list-header__grid ${headerGridClass} py-2 text-[11px]`}
          style={{ gridTemplateColumns }}
          role="row"
        >
          <ListHeaderCell
            columnIndex={0}
            resizable
            onResizeColumn={onResizeColumn}
            onResetColumn={onResetColumn}
          >
            <HeaderColumn
              align="center"
              sort={
                <span className="text-[10px] text-av-text-muted/80 font-medium" aria-hidden>
                  {t('columns.thumb')}
                </span>
              }
            />
          </ListHeaderCell>

          <ListHeaderCell
            columnIndex={1}
            resizable
            onResizeColumn={onResizeColumn}
            onResetColumn={onResetColumn}
          >
            <HeaderColumn
              sort={<SortButton label={t('columns.name')} field="filename" {...sortProps} />}
            />
          </ListHeaderCell>

          <ListHeaderCell
            columnIndex={2}
            resizable
            onResizeColumn={onResizeColumn}
            onResetColumn={onResetColumn}
          >
            <HeaderColumn
              sort={<SortButton label={t('columns.size')} field="fileSize" {...sortProps} />}
              filter={
                <FileSizeFilterControl
                  sizePreset={sizePresetFilter}
                  minMb={fileSizeMinMb}
                  maxMb={fileSizeMaxMb}
                  onPresetChange={onSizePreset}
                  onMbChange={onFileSizeMb}
                  selectClass="av-list-filter"
                  inputClass="av-list-filter-input"
                  layout="header"
                />
              }
            />
          </ListHeaderCell>

          <ListHeaderCell
            columnIndex={3}
            resizable
            onResizeColumn={onResizeColumn}
            onResetColumn={onResetColumn}
          >
            <HeaderColumn
              sort={<SortButton label={t('columns.type')} field="fileType" {...sortProps} />}
              filter={
                <select
                  className="av-list-filter"
                  value={fileTypeFilter ?? ''}
                  onChange={(e) => onFileTypeFilter(e.target.value || null)}
                  title={t('filterByType')}
                >
                  <option value="">{t('all')}</option>
                  {FILE_TYPE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {fileTypeLabel(id)}
                    </option>
                  ))}
                </select>
              }
            />
          </ListHeaderCell>

          <ListHeaderCell
            columnIndex={4}
            resizable
            onResizeColumn={onResizeColumn}
            onResetColumn={onResetColumn}
          >
            <HeaderColumn
              sort={<SortButton label={t('columns.extension')} field="extension" {...sortProps} />}
            />
          </ListHeaderCell>

          <ListHeaderCell
            columnIndex={5}
            resizable
            onResizeColumn={onResizeColumn}
            onResetColumn={onResetColumn}
          >
            <HeaderColumn
              sort={<SortButton label={t('columns.importedAt')} field="importedAt" {...sortProps} />}
              filter={
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
              }
            />
          </ListHeaderCell>

          <ListHeaderCell columnIndex={6}>
            <HeaderColumn
              align="end"
              sort={
                <SortButton label={t('columns.dominantColor')} field="dominantColor" {...sortProps} />
              }
              filter={
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
              }
            />
          </ListHeaderCell>
        </div>
      )}
    </div>
  )
}
