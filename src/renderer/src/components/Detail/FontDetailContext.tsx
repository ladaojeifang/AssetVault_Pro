import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { formatFileSizeMbFilterLabel } from '@/shared/assetFilters'
import type { DatePreset, SizePreset } from '@/shared/assetFilters'
import type { FontAppSettings } from '@/shared/fontSettings'
import type { FontFamilyGroup } from '@/shared/fontTypes'
import { useApp } from '../../stores/AppContext'
import {
  translateDatePresetLabel,
  translateSizePresetLabel
} from '../../utils/assetFilterLabels'

function buildFontFilterChips(
  t: TFunction<'detail'>,
  ta: TFunction<'assets'>,
  p: {
    debouncedSearch: string
    colorBucketFilter: string | null
    sizePresetFilter: SizePreset | null
    fileSizeMinMb: number | null
    fileSizeMaxMb: number | null
    datePresetFilter: DatePreset | null
    tagFilters: string[]
  }
): string[] {
  const filters: string[] = []
  const q = p.debouncedSearch.trim()
  if (q) filters.push(t('context.filter.search', { query: q }))
  if (p.colorBucketFilter) filters.push(t('context.filter.color', { value: p.colorBucketFilter }))
  if (p.sizePresetFilter) {
    filters.push(
      t('context.filter.sizePreset', {
        value: translateSizePresetLabel(ta, p.sizePresetFilter)
      })
    )
  }
  const mbLabel = formatFileSizeMbFilterLabel(p.fileSizeMinMb, p.fileSizeMaxMb)
  if (mbLabel) filters.push(t('context.filter.volume', { value: mbLabel }))
  if (p.datePresetFilter) {
    filters.push(
      t('context.filter.date', { value: translateDatePresetLabel(ta, p.datePresetFilter) })
    )
  }
  if (p.tagFilters.length > 0) {
    filters.push(t('context.font.tagFilters', { count: p.tagFilters.length }))
  }
  return filters
}

function DetailPanelShell({
  title,
  subtitle,
  preview,
  children,
  onClose
}: {
  title: string
  subtitle?: string
  preview?: React.ReactNode
  children: React.ReactNode
  onClose: () => void
}) {
  const { t } = useTranslation('detail')
  return (
    <div className="h-full flex flex-col bg-av-bg-secondary">
      <div className="flex items-center justify-between px-4 py-3 border-b border-av-border shrink-0">
        <div className="min-w-0 flex-1 mr-2">
          <p className="text-sm font-semibold truncate">{title}</p>
          {subtitle ? <p className="text-[11px] text-av-text-muted truncate mt-0.5">{subtitle}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="btn-icon shrink-0" title={t('closePanel')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {preview ? (
        <div className="relative w-full aspect-video bg-av-bg-primary overflow-hidden shrink-0 border-b border-av-border">
          {preview}
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide">{children}</div>
    </div>
  )
}

function ContextInfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-av-text-muted uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function ContextInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm gap-3">
      <span className="text-av-text-muted shrink-0">{label}</span>
      <span className="text-av-text-primary font-medium text-right min-w-0 break-all">{value}</span>
    </div>
  )
}

function extensionCounts(groups: FontFamilyGroup[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const g of groups) {
    for (const a of g.assets) {
      const ext = (a.filename.split('.').pop() ?? '').toLowerCase() || '—'
      m.set(ext, (m.get(ext) ?? 0) + 1)
    }
  }
  return m
}

function useFontFamilyGroups(): {
  groups: FontFamilyGroup[]
  loading: boolean
  reload: () => void
} {
  const [groups, setGroups] = useState<FontFamilyGroup[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    void window.assetVaultAPI.fonts
      .listFamilyGroups()
      .then((list) => setGroups(list))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { groups, loading, reload }
}

function FontFamilyList({
  groups,
  selectedFamilyKey,
  onSelectFamily,
  onSelectAsset
}: {
  groups: FontFamilyGroup[]
  selectedFamilyKey: string | null
  onSelectFamily: (key: string) => void
  onSelectAsset: (assetId: string, familyKey: string) => void
}) {
  const { t } = useTranslation('detail')
  return (
    <div className="space-y-2 max-h-[min(420px,50vh)] overflow-y-auto pr-1 scrollbar-hide">
      {groups.map((g) => {
        const active = selectedFamilyKey === g.familyKey
        return (
          <div
            key={g.familyKey}
            className={`rounded-lg border px-2.5 py-2 transition-colors ${
              active
                ? 'border-av-accent-blue/50 bg-av-accent-blue/10'
                : 'border-av-border/60 bg-av-bg-primary/40'
            }`}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onSelectFamily(g.familyKey)}
            >
              <p className="text-sm font-medium text-av-text-primary truncate">{g.familyName}</p>
              <p className="text-[10px] text-av-text-muted mt-0.5">
                {t('context.font.filesCount', { count: g.assets.length })}
                {g.assets.some((a) => a.ttcIndex != null) ? t('context.font.includesTtc') : ''}
              </p>
            </button>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {g.assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.filename}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-av-bg-elevated hover:bg-av-bg-hover text-av-text-secondary truncate max-w-full"
                  onClick={() => onSelectAsset(a.id, g.familyKey)}
                >
                  {a.subfamilyName ?? a.filename.replace(/\.[^.]+$/, '')}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 选中 Types → 字体：资料库内全部字体概览 */
export function FontTypeContextView({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('detail')
  const { t: ta } = useTranslation('assets')
  const {
    totalAssets,
    debouncedSearch,
    colorBucketFilter,
    sizePresetFilter,
    fileSizeMinMb,
    fileSizeMaxMb,
    datePresetFilter,
    tagFilters,
    selectedFontFamilyKey,
    setSelectedFontFamilyKey,
    selectMultiple,
    setDetailPanelOpen
  } = useApp()
  const { groups, loading, reload } = useFontFamilyGroups()
  const [fontSettings, setFontSettings] = useState<FontAppSettings | null>(null)

  useEffect(() => {
    void window.assetVaultAPI.fonts.getSettings().then(setFontSettings)
  }, [])

  const fileCount = useMemo(
    () => groups.reduce((n, g) => n + g.assets.length, 0),
    [groups]
  )
  const extMap = useMemo(() => extensionCounts(groups), [groups])

  const filters = buildFontFilterChips(t, ta, {
    debouncedSearch,
    colorBucketFilter,
    sizePresetFilter,
    fileSizeMinMb,
    fileSizeMaxMb,
    datePresetFilter,
    tagFilters
  })

  const sampleLines = (fontSettings?.thumbSampleText ?? 'VibeShotClub\nAIGC创作').split('\n')

  const handleSelectAsset = (assetId: string, familyKey: string) => {
    setSelectedFontFamilyKey(familyKey)
    selectMultiple([assetId])
    setDetailPanelOpen(true)
  }

  return (
    <DetailPanelShell
      title={t('context.font.title')}
      subtitle={t('context.font.typeSubtitle')}
      onClose={onClose}
      preview={
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-6 bg-av-bg-primary">
          <span className="text-4xl">🔤</span>
          <div className="text-center w-full max-w-full">
            {sampleLines.map((line, i) => (
              <p
                key={i}
                className={`text-av-text-primary truncate w-full ${
                  i === 0 ? 'text-xl font-semibold' : 'text-base text-av-text-secondary mt-1'
                }`}
                style={{ fontFamily: 'inherit' }}
              >
                {line || ' '}
              </p>
            ))}
          </div>
          <p className="text-[10px] text-av-text-muted mt-1">{t('context.font.thumbSample')}</p>
        </div>
      }
    >
      <ContextInfoSection title={t('context.font.statsSection')}>
        <ContextInfoRow label={t('context.font.matchEntries')} value={totalAssets.toLocaleString()} />
        <ContextInfoRow
          label={t('context.font.families')}
          value={loading ? '…' : String(groups.length)}
        />
        <ContextInfoRow label={t('context.font.files')} value={loading ? '…' : String(fileCount)} />
        {filters.length > 0 ? (
          <ContextInfoRow label={t('context.labels.extraFilters')} value={filters.join(' · ')} />
        ) : null}
      </ContextInfoSection>

      {!loading && extMap.size > 0 ? (
        <ContextInfoSection title={t('context.font.formatSection')}>
          {Array.from(extMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([ext, count]) => (
              <ContextInfoRow key={ext} label={`.${ext}`} value={String(count)} />
            ))}
        </ContextInfoSection>
      ) : null}

      {fontSettings ? (
        <ContextInfoSection title={t('context.font.thumbSettingsSection')}>
          <ContextInfoRow
            label={t('context.font.sampleVersion')}
            value={`v${fontSettings.thumbSampleVersion}`}
          />
          <p className="text-[11px] text-av-text-muted leading-relaxed whitespace-pre-wrap">
            {fontSettings.thumbSampleText}
          </p>
        </ContextInfoSection>
      ) : null}

      <ContextInfoSection title={t('context.font.familiesSection')}>
        {loading ? (
          <p className="text-xs text-av-text-muted">{t('context.font.loading')}</p>
        ) : groups.length === 0 ? (
          <p className="text-xs text-av-text-muted">{t('context.font.noFonts')}</p>
        ) : (
          <FontFamilyList
            groups={groups}
            selectedFamilyKey={selectedFontFamilyKey}
            onSelectFamily={setSelectedFontFamilyKey}
            onSelectAsset={handleSelectAsset}
          />
        )}
      </ContextInfoSection>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-xs" disabled={loading} onClick={reload}>
          {t('context.font.refreshList')}
        </button>
      </div>

      <p className="text-[11px] text-av-text-muted leading-relaxed">{t('context.font.typeFooterHint')}</p>
    </DetailPanelShell>
  )
}

/** 侧栏选中某一字体族 */
export function FontFamilyContextView({
  familyKey,
  onClose
}: {
  familyKey: string
  onClose: () => void
}) {
  const { t } = useTranslation('detail')
  const { groups, loading } = useFontFamilyGroups()
  const { selectMultiple, setDetailPanelOpen, openFontPreview, setSelectedFontFamilyKey } = useApp()

  const group = useMemo(
    () => groups.find((g) => g.familyKey === familyKey) ?? null,
    [groups, familyKey]
  )

  const extMap = useMemo(() => (group ? extensionCounts([group]) : new Map()), [group])

  if (loading && !group) {
    return (
      <DetailPanelShell title={t('context.font.familyTitle')} subtitle={t('context.font.loadingSubtitle')} onClose={onClose}>
        <p className="text-xs text-av-text-muted">{t('context.font.loadingFamily')}</p>
      </DetailPanelShell>
    )
  }

  if (!group) {
    return (
      <DetailPanelShell title={t('context.font.familyTitle')} subtitle={t('context.font.notFoundSubtitle')} onClose={onClose}>
        <p className="text-xs text-av-text-muted">{t('context.font.notFound')}</p>
      </DetailPanelShell>
    )
  }

  return (
    <DetailPanelShell
      title={group.familyName}
      subtitle={t('context.font.familySubtitle')}
      onClose={onClose}
      preview={
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-4 bg-av-bg-primary">
          <span className="text-3xl text-av-text-primary" style={{ fontFamily: 'inherit' }}>
            {group.familyName}
          </span>
          <p className="text-sm text-av-text-muted">{t('context.font.familyPreview')}</p>
        </div>
      }
    >
      <button
        type="button"
        className="btn-ghost text-xs -mt-1 mb-1 px-0"
        onClick={() => setSelectedFontFamilyKey(null)}
      >
        {t('context.font.backToAllFonts')}
      </button>

      <ContextInfoSection title={t('context.font.overviewSection')}>
        <ContextInfoRow label={t('context.font.familyName')} value={group.familyName} />
        <ContextInfoRow label={t('context.font.fileCount')} value={String(group.assets.length)} />
        <ContextInfoRow label={t('context.font.familyKey')} value={group.familyKey} />
      </ContextInfoSection>

      {extMap.size > 0 ? (
        <ContextInfoSection title={t('context.font.formatSectionShort')}>
          {Array.from(extMap.entries()).map(([ext, count]) => (
            <ContextInfoRow key={ext} label={`.${ext}`} value={String(count)} />
          ))}
        </ContextInfoSection>
      ) : null}

      <ContextInfoSection title={t('context.font.includedFilesSection')}>
        <ul className="space-y-2">
          {group.assets.map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-av-border/50 bg-av-bg-primary/50 px-2 py-1.5"
            >
              <p className="text-xs font-medium text-av-text-primary truncate">{a.filename}</p>
              {a.subfamilyName ? (
                <p className="text-[10px] text-av-text-muted">{a.subfamilyName}</p>
              ) : null}
              <div className="flex gap-1.5 mt-1.5">
                <button
                  type="button"
                  className="btn-secondary text-[10px] py-0.5 px-2"
                  onClick={() => {
                    selectMultiple([a.id])
                    setDetailPanelOpen(true)
                  }}
                >
                  {t('context.font.detailBtn')}
                </button>
                <button
                  type="button"
                  className="btn-ghost text-[10px] py-0.5 px-2"
                  onClick={() => openFontPreview(a.id)}
                >
                  {t('context.font.fullscreenPreview')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </ContextInfoSection>
    </DetailPanelShell>
  )
}
