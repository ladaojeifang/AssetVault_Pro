import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { formatFileSizeMbFilterLabel } from '@/shared/assetFilters'
import type { FontAppSettings } from '@/shared/fontSettings'
import type { FontFamilyGroup } from '@/shared/fontTypes'
import { useApp } from '../../stores/AppContext'

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
  return (
    <div className="h-full flex flex-col bg-av-bg-secondary">
      <div className="flex items-center justify-between px-4 py-3 border-b border-av-border shrink-0">
        <div className="min-w-0 flex-1 mr-2">
          <p className="text-sm font-semibold truncate">{title}</p>
          {subtitle ? <p className="text-[11px] text-av-text-muted truncate mt-0.5">{subtitle}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="btn-icon shrink-0" title="关闭面板">
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
                {g.assets.length} 个文件
                {g.assets.some((a) => a.ttcIndex != null) ? ' · 含 TTC' : ''}
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

  const filters: string[] = []
  if (debouncedSearch.trim()) filters.push(`搜索「${debouncedSearch.trim()}」`)
  if (colorBucketFilter) filters.push(`颜色 ${colorBucketFilter}`)
  if (sizePresetFilter) filters.push(`尺寸 ${sizePresetFilter}`)
  const mbLabel = formatFileSizeMbFilterLabel(fileSizeMinMb, fileSizeMaxMb)
  if (mbLabel) filters.push(`体积 ${mbLabel}`)
  if (datePresetFilter) filters.push(`日期 ${datePresetFilter}`)
  if (tagFilters.length > 0) filters.push(`${tagFilters.length} 个标签`)

  const sampleLines = (fontSettings?.thumbSampleText ?? 'VibeShotClub\nAIGC创作').split('\n')

  const handleSelectAsset = (assetId: string, familyKey: string) => {
    setSelectedFontFamilyKey(familyKey)
    selectMultiple([assetId])
    setDetailPanelOpen(true)
  }

  return (
    <DetailPanelShell
      title="字体"
      subtitle="类型筛选 · 全部字体"
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
          <p className="text-[10px] text-av-text-muted mt-1">缩略图样例文字</p>
        </div>
      }
    >
      <ContextInfoSection title="统计">
        <ContextInfoRow label="匹配条目" value={totalAssets.toLocaleString()} />
        <ContextInfoRow label="字体族" value={loading ? '…' : String(groups.length)} />
        <ContextInfoRow label="字体文件" value={loading ? '…' : String(fileCount)} />
        {filters.length > 0 ? <ContextInfoRow label="附加筛选" value={filters.join(' · ')} /> : null}
      </ContextInfoSection>

      {!loading && extMap.size > 0 ? (
        <ContextInfoSection title="格式分布">
          {Array.from(extMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([ext, count]) => (
              <ContextInfoRow key={ext} label={`.${ext}`} value={String(count)} />
            ))}
        </ContextInfoSection>
      ) : null}

      {fontSettings ? (
        <ContextInfoSection title="缩略图设置">
          <ContextInfoRow label="样例版本" value={`v${fontSettings.thumbSampleVersion}`} />
          <p className="text-[11px] text-av-text-muted leading-relaxed whitespace-pre-wrap">
            {fontSettings.thumbSampleText}
          </p>
        </ContextInfoSection>
      ) : null}

      <ContextInfoSection title="字体族">
        {loading ? (
          <p className="text-xs text-av-text-muted">加载中…</p>
        ) : groups.length === 0 ? (
          <p className="text-xs text-av-text-muted">当前筛选下没有字体文件</p>
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
          刷新列表
        </button>
      </div>

      <p className="text-[11px] text-av-text-muted leading-relaxed">
        点击字体族查看该族详情；点击字重/文件名可在下方查看单个字体文件信息。双击网格中的字体可打开全屏预览。
      </p>
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
  const { groups, loading } = useFontFamilyGroups()
  const { selectMultiple, setDetailPanelOpen, openFontPreview, setSelectedFontFamilyKey } = useApp()

  const group = useMemo(
    () => groups.find((g) => g.familyKey === familyKey) ?? null,
    [groups, familyKey]
  )

  const extMap = useMemo(() => (group ? extensionCounts([group]) : new Map()), [group])

  if (loading && !group) {
    return (
      <DetailPanelShell title="字体族" subtitle="加载中…" onClose={onClose}>
        <p className="text-xs text-av-text-muted">正在加载字体信息…</p>
      </DetailPanelShell>
    )
  }

  if (!group) {
    return (
      <DetailPanelShell title="字体族" subtitle="未找到" onClose={onClose}>
        <p className="text-xs text-av-text-muted">该字体族不存在或已被移除。</p>
      </DetailPanelShell>
    )
  }

  return (
    <DetailPanelShell
      title={group.familyName}
      subtitle="字体族"
      onClose={onClose}
      preview={
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-4 bg-av-bg-primary">
          <span className="text-3xl text-av-text-primary" style={{ fontFamily: 'inherit' }}>
            {group.familyName}
          </span>
          <p className="text-sm text-av-text-muted">Aa 字体族预览</p>
        </div>
      }
    >
      <button
        type="button"
        className="btn-ghost text-xs -mt-1 mb-1 px-0"
        onClick={() => setSelectedFontFamilyKey(null)}
      >
        ← 全部字体
      </button>

      <ContextInfoSection title="概览">
        <ContextInfoRow label="族名称" value={group.familyName} />
        <ContextInfoRow label="文件数" value={String(group.assets.length)} />
        <ContextInfoRow label="族键" value={group.familyKey} />
      </ContextInfoSection>

      {extMap.size > 0 ? (
        <ContextInfoSection title="格式">
          {Array.from(extMap.entries()).map(([ext, count]) => (
            <ContextInfoRow key={ext} label={`.${ext}`} value={String(count)} />
          ))}
        </ContextInfoSection>
      ) : null}

      <ContextInfoSection title="包含文件">
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
                  详情
                </button>
                <button
                  type="button"
                  className="btn-ghost text-[10px] py-0.5 px-2"
                  onClick={() => openFontPreview(a.id)}
                >
                  全屏预览
                </button>
              </div>
            </li>
          ))}
        </ul>
      </ContextInfoSection>
    </DetailPanelShell>
  )
}
