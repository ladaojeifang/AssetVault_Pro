import React, { useEffect, useState } from 'react'
import type { SizePreset } from '@/shared/assetFilters'
import { SIZE_PRESET_OPTIONS, parseMbInput } from '@/shared/assetFilters'

type Props = {
  sizePreset: SizePreset | null
  minMb: number | null
  maxMb: number | null
  onPresetChange: (preset: SizePreset | null) => void
  onMbChange: (minMb: number | null, maxMb: number | null) => void
  selectClass?: string
  inputClass?: string
  compact?: boolean
  /** stack = 预设在上、MB 在下；inline = 同一行；header = 表头紧凑两行 */
  layout?: 'stack' | 'inline' | 'header'
}

export function FileSizeFilterControl({
  sizePreset,
  minMb,
  maxMb,
  onPresetChange,
  onMbChange,
  selectClass = 'w-full max-w-full bg-av-bg-elevated text-av-text-secondary border border-av-border/60 rounded px-1 py-0.5 text-[10px] outline-none cursor-pointer focus:border-av-accent-blue',
  inputClass = 'w-12 bg-av-bg-elevated text-av-text-secondary border border-av-border/60 rounded px-1 py-0.5 text-[10px] outline-none focus:border-av-accent-blue tabular-nums',
  compact = false,
  layout = 'stack'
}: Props): React.ReactElement {
  const [minDraft, setMinDraft] = useState(minMb != null ? String(minMb) : '')
  const [maxDraft, setMaxDraft] = useState(maxMb != null ? String(maxMb) : '')

  useEffect(() => {
    setMinDraft(minMb != null ? String(minMb) : '')
    setMaxDraft(maxMb != null ? String(maxMb) : '')
  }, [minMb, maxMb])

  const commitMb = () => {
    const parsedMin = parseMbInput(minDraft)
    const parsedMax = parseMbInput(maxDraft)
    if (parsedMin != null && parsedMax != null && parsedMin > parsedMax) {
      onMbChange(parsedMax, parsedMin)
      setMinDraft(String(parsedMax))
      setMaxDraft(String(parsedMin))
      return
    }
    onMbChange(parsedMin, parsedMax)
  }

  const clearMb = () => {
    setMinDraft('')
    setMaxDraft('')
    onMbChange(null, null)
  }

  const hasMb = minMb != null || maxMb != null

  const presetSelect = (
    <select
      className={
        layout === 'header'
          ? `${selectClass} av-list-filter--preset shrink-0`
          : layout === 'inline'
            ? `${selectClass} w-auto max-w-[4.5rem] shrink-0`
            : selectClass
      }
      value={sizePreset ?? ''}
      onChange={(e) => {
        const v = (e.target.value || null) as SizePreset | null
        onPresetChange(v)
      }}
      title="按像素尺寸预设筛选（小/中/大图）"
    >
      <option value="">预设…</option>
      {SIZE_PRESET_OPTIONS.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  )

  const mbInputClass =
    layout === 'header' ? `${inputClass} av-list-filter-input--narrow` : inputClass

  const mbRowClass =
    layout === 'header'
      ? 'flex items-center gap-0.5 min-w-0 flex-1'
      : 'flex items-center gap-0.5 shrink-0'

  const mbInputs = (
    <div className={mbRowClass} title="按文件体积 (MB) 筛选">
      <span className="text-[9px] text-av-text-muted shrink-0">≥</span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="MB"
        className={mbInputClass}
        value={minDraft}
        disabled={!!sizePreset}
        onChange={(e) => setMinDraft(e.target.value)}
        onBlur={commitMb}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitMb()
          }
        }}
      />
      <span className="text-[9px] text-av-text-muted shrink-0">≤</span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="MB"
        className={mbInputClass}
        value={maxDraft}
        disabled={!!sizePreset}
        onChange={(e) => setMaxDraft(e.target.value)}
        onBlur={commitMb}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitMb()
          }
        }}
      />
      {hasMb && !sizePreset ? (
        <button
          type="button"
          className="text-[9px] text-av-text-muted hover:text-av-accent-blue px-0.5 shrink-0"
          onClick={clearMb}
          title="清除 MB 筛选"
        >
          ×
        </button>
      ) : null}
    </div>
  )

  if (layout === 'inline' || layout === 'header') {
    return (
      <div
        className={
          layout === 'header'
            ? 'flex items-center gap-1 min-w-0 w-full flex-nowrap'
            : 'flex items-center gap-1 min-w-0 flex-wrap'
        }
      >
        {presetSelect}
        {mbInputs}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1 min-w-0 w-full ${compact ? '' : ''}`}>
      {presetSelect}
      {mbInputs}
    </div>
  )
}
