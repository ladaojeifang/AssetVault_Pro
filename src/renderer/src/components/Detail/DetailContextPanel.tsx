import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { formatFileSizeMbFilterLabel } from '@/shared/assetFilters'
import type { DatePreset, SizePreset } from '@/shared/assetFilters'
import { useApp } from '../../stores/AppContext'
import { findFolderInTree, getChildFolders } from '../../utils/folderTreeNav'
import { FolderIconDisplay } from '../Common/FolderIconDisplay'
import { FontFamilyContextView, FontTypeContextView } from './FontDetailContext'
import {
  translateDatePresetLabel,
  translateSizePresetLabel
} from '../../utils/assetFilterLabels'

const FILE_TYPE_META: Record<string, { label: string; emoji: string }> = {
  image: { label: 'Images', emoji: '🖼️' },
  video: { label: 'Videos', emoji: '🎬' },
  audio: { label: 'Audio', emoji: '🎵' },
  font: { label: 'Fonts', emoji: '🔤' },
  design: { label: 'Design', emoji: '🎨' },
  document: { label: 'Docs', emoji: '📄' },
  '3d': { label: '3D', emoji: '📦' },
  code: { label: 'Code', emoji: '💻' },
  other: { label: 'Other', emoji: '📎' }
}

function buildActiveFilterChips(
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
    filters.push(t('context.filter.tags', { count: p.tagFilters.length }))
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

function FolderContextView({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('detail')
  const { currentFolderId, folderTree } = useApp()
  const folder = currentFolderId ? findFolderInTree(folderTree, currentFolderId) : null
  const [coverSrc, setCoverSrc] = useState<string | null>(null)
  const [iconSrc, setIconSrc] = useState<string | null>(null)

  const childFolders = useMemo(
    () => (folder ? getChildFolders(folderTree, folder.id) : []),
    [folder, folderTree]
  )

  useEffect(() => {
    if (!folder) return
    let cancelled = false

    if (folder.icon?.startsWith('folder-icons/')) {
      void window.assetVaultAPI.folders.getIconDataUrl(folder.icon).then((url) => {
        if (!cancelled) setIconSrc(url)
      })
    } else {
      setIconSrc(null)
    }

    void window.assetVaultAPI.folders.getCoverAssetIds([folder.id]).then(async (map) => {
      const assetId = map[folder.id]
      if (!assetId || cancelled) return
      const thumb = await window.assetVaultAPI.assets.getThumbnail(assetId)
      if (!cancelled && thumb) setCoverSrc(thumb as string)
    })

    return () => {
      cancelled = true
    }
  }, [folder?.id, folder?.icon])

  if (!folder) {
    return <LibraryContextView onClose={onClose} />
  }

  const accent = folder.color?.trim() || '#64748b'

  return (
    <DetailPanelShell
      title={folder.name}
      subtitle={t('context.folder.subtitle')}
      onClose={onClose}
      preview={
        coverSrc ? (
          <img src={coverSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ backgroundColor: `${accent}22` }}
          >
            {iconSrc ? (
              <img src={iconSrc} alt="" className="w-16 h-16 rounded-lg object-cover border border-av-border" />
            ) : (
              <FolderIconDisplay icon={folder.icon} fallbackEmoji="📂" size={48} />
            )}
            <p className="text-xs text-av-text-muted">
              {t('context.folder.assetCount', { count: folder.assetCount })}
            </p>
          </div>
        )
      }
    >
      <ContextInfoSection title={t('context.folder.infoSection')}>
        <ContextInfoRow label={t('context.labels.name')} value={folder.name} />
        <ContextInfoRow label={t('context.labels.assetCount')} value={String(folder.assetCount)} />
        <ContextInfoRow label={t('context.labels.subfolders')} value={String(childFolders.length)} />
        <ContextInfoRow
          label={t('context.labels.level')}
          value={t('context.labels.levelValue', { n: folder.level + 1 })}
        />
        <ContextInfoRow label={t('context.labels.path')} value={folder.path || '/'} />
        <ContextInfoRow label={t('context.labels.created')} value={new Date(folder.createdAt).toLocaleString()} />
        <ContextInfoRow label={t('context.labels.updated')} value={new Date(folder.updatedAt).toLocaleString()} />
      </ContextInfoSection>
      {childFolders.length > 0 ? (
        <ContextInfoSection title={t('context.folder.subfolderSection')}>
          <div className="space-y-1">
            {childFolders.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-2 text-sm py-1 px-2 rounded-md bg-av-bg-primary/60"
                style={{ borderLeft: `3px solid ${child.color ?? '#64748b'}` }}
              >
                <FolderIconDisplay icon={child.icon} fallbackEmoji="📂" size={14} />
                <span className="truncate flex-1">{child.name}</span>
                <span className="text-[11px] text-av-text-muted tabular-nums">{child.assetCount}</span>
              </div>
            ))}
          </div>
        </ContextInfoSection>
      ) : null}
      <p className="text-[11px] text-av-text-muted leading-relaxed">{t('context.folder.footerHint')}</p>
    </DetailPanelShell>
  )
}

function TypeContextView({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('detail')
  const { t: ta } = useTranslation('assets')
  const {
    fileTypeFilter,
    totalAssets,
    debouncedSearch,
    tagFilters,
    colorBucketFilter,
    sizePresetFilter,
    fileSizeMinMb,
    fileSizeMaxMb,
    datePresetFilter
  } = useApp()
  const meta = fileTypeFilter ? FILE_TYPE_META[fileTypeFilter] : null

  if (!meta || !fileTypeFilter) {
    return <LibraryContextView onClose={onClose} />
  }

  const filters = buildActiveFilterChips(t, ta, {
    debouncedSearch,
    colorBucketFilter,
    sizePresetFilter,
    fileSizeMinMb,
    fileSizeMaxMb,
    datePresetFilter,
    tagFilters
  })

  const desc = t(`context.fileTypeDesc.${fileTypeFilter}` as 'context.fileTypeDesc.image')

  return (
    <DetailPanelShell
      title={meta.label}
      subtitle={t('context.type.subtitle')}
      onClose={onClose}
      preview={
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-av-bg-primary">
          <span className="text-5xl">{meta.emoji}</span>
          <p className="text-sm text-av-text-secondary">{desc}</p>
        </div>
      }
    >
      <ContextInfoSection title={t('context.type.infoSection')}>
        <ContextInfoRow label={t('context.labels.typeId')} value={fileTypeFilter} />
        <ContextInfoRow label={t('context.labels.matchCount')} value={totalAssets.toLocaleString()} />
        {filters.length > 0 ? (
          <ContextInfoRow label={t('context.labels.extraFilters')} value={filters.join(' · ')} />
        ) : null}
      </ContextInfoSection>
      <p className="text-[11px] text-av-text-muted leading-relaxed">{t('context.type.footerHint')}</p>
    </DetailPanelShell>
  )
}

function LibraryContextView({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('detail')
  const { totalAssets, folderTree, tags } = useApp()
  const [libraryState, setLibraryState] = useState<{
    libraryDisplayName: string
    activeLibraryRoot: string
  } | null>(null)
  const [storage, setStorage] = useState<{
    assetRowCount: number
    itemPackCount: number
    itemsDir: string
  } | null>(null)

  const folderCount = useMemo(() => {
    let n = 0
    const walk = (nodes: typeof folderTree) => {
      for (const node of nodes) {
        n += 1
        if (node.children?.length) walk(node.children)
      }
    }
    walk(folderTree)
    return n
  }, [folderTree])

  useEffect(() => {
    let cancelled = false
    void window.assetVaultAPI.library.getState().then((s) => {
      if (!cancelled) {
        setLibraryState({
          libraryDisplayName: s.libraryDisplayName,
          activeLibraryRoot: s.activeLibraryRoot
        })
      }
    })
    void window.assetVaultAPI.library.getStorageStats().then((s) => {
      if (!cancelled) setStorage(s)
    })
    const unsub = window.assetVaultAPI.library.onLibrarySwitched(() => {
      void window.assetVaultAPI.library.getState().then((s) => {
        if (!cancelled) {
          setLibraryState({
            libraryDisplayName: s.libraryDisplayName,
            activeLibraryRoot: s.activeLibraryRoot
          })
        }
      })
      void window.assetVaultAPI.library.getStorageStats().then((s) => {
        if (!cancelled) setStorage(s)
      })
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  return (
    <DetailPanelShell
      title={libraryState?.libraryDisplayName ?? t('context.library.defaultTitle')}
      subtitle={t('context.library.subtitle')}
      onClose={onClose}
      preview={
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-av-bg-primary to-av-bg-elevated">
          <span className="text-5xl">🗂</span>
          <p className="text-lg font-semibold text-av-text-primary tabular-nums">
            {t('context.library.assetCount', { count: totalAssets.toLocaleString() })}
          </p>
        </div>
      }
    >
      <ContextInfoSection title={t('context.library.infoSection')}>
        <ContextInfoRow label={t('context.labels.name')} value={libraryState?.libraryDisplayName ?? '…'} />
        <ContextInfoRow label={t('context.labels.totalAssets')} value={totalAssets.toLocaleString()} />
        <ContextInfoRow label={t('context.labels.folders')} value={String(folderCount)} />
        <ContextInfoRow label={t('context.labels.tags')} value={String(tags.length)} />
        {storage ? (
          <>
            <ContextInfoRow label={t('context.labels.itemPacks')} value={String(storage.itemPackCount)} />
            <ContextInfoRow label={t('context.labels.dbRows')} value={String(storage.assetRowCount)} />
          </>
        ) : null}
      </ContextInfoSection>
      {libraryState?.activeLibraryRoot ? (
        <ContextInfoSection title={t('context.library.storageSection')}>
          <p className="text-[11px] font-mono text-av-text-secondary leading-relaxed break-all select-all">
            {libraryState.activeLibraryRoot}
          </p>
          {storage?.itemsDir ? (
            <p className="text-[11px] font-mono text-av-text-muted leading-relaxed break-all mt-1 select-all">
              {storage.itemsDir}
            </p>
          ) : null}
        </ContextInfoSection>
      ) : null}
      <p className="text-[11px] text-av-text-muted leading-relaxed">{t('context.library.footerHint')}</p>
    </DetailPanelShell>
  )
}

const DetailContextPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentFolderId, fileTypeFilter, selectedFontFamilyKey } = useApp()

  if (currentFolderId) {
    return <FolderContextView onClose={onClose} />
  }
  if (fileTypeFilter === 'font') {
    if (selectedFontFamilyKey) {
      return <FontFamilyContextView familyKey={selectedFontFamilyKey} onClose={onClose} />
    }
    return <FontTypeContextView onClose={onClose} />
  }
  if (fileTypeFilter) {
    return <TypeContextView onClose={onClose} />
  }
  return <LibraryContextView onClose={onClose} />
}

export default DetailContextPanel
