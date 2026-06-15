import React, { useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeExtensionFilter } from '@/shared/assetFilters'

type Props = {
  value: string | null
  onChange: (extension: string | null) => void
  options?: string[]
  selectClass?: string
  inputClass?: string
  layout?: 'stack' | 'inline'
}

export function ExtensionFilterControl({
  value,
  onChange,
  options: optionsProp,
  selectClass = 'av-list-filter',
  inputClass = 'av-list-filter-input',
  layout = 'stack'
}: Props): React.ReactElement {
  const { t } = useTranslation('assets')
  const datalistId = useId()
  const [options, setOptions] = useState<string[]>(optionsProp ?? [])
  const [draft, setDraft] = useState(value ? `.${value}` : '')

  useEffect(() => {
    if (optionsProp) {
      setOptions(optionsProp)
      return
    }
    let cancelled = false
    void window.assetVaultAPI.assets
      .listExtensions()
      .then((exts) => {
        if (!cancelled) setOptions(exts)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [optionsProp])

  useEffect(() => {
    setDraft(value ? `.${value}` : '')
  }, [value])

  const commitDraft = useCallback(() => {
    const trimmed = draft.trim()
    const next = normalizeExtensionFilter(draft)
    if (trimmed && !next) {
      setDraft(value ? `.${value}` : '')
      return
    }
    if (next === value) return
    onChange(next)
  }, [draft, onChange, value])

  const selectValue = value && options.includes(value) ? value : ''

  const controls = (
    <>
      <select
        className={layout === 'inline' ? `${selectClass} shrink-0 max-w-[4.5rem]` : selectClass}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value || null
          onChange(next)
          setDraft(next ? `.${next}` : '')
        }}
        title={t('extensionFilter.selectTitle')}
      >
        <option value="">{t('all')}</option>
        {options.map((ext) => (
          <option key={ext} value={ext}>
            .{ext}
          </option>
        ))}
      </select>
      <input
        type="text"
        className={layout === 'inline' ? `${inputClass} min-w-0 flex-1` : `${inputClass} w-full`}
        list={datalistId}
        value={draft}
        placeholder={t('extensionFilter.placeholder')}
        title={t('extensionFilter.inputTitle')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitDraft()
          }
          if (e.key === 'Escape') {
            setDraft(value ? `.${value}` : '')
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      <datalist id={datalistId}>
        {options.map((ext) => (
          <option key={ext} value={`.${ext}`} />
        ))}
      </datalist>
    </>
  )

  if (layout === 'inline') {
    return <div className="flex items-center gap-1 min-w-0 w-full">{controls}</div>
  }

  return <div className="flex flex-col gap-0.5 min-w-0 w-full">{controls}</div>
}
