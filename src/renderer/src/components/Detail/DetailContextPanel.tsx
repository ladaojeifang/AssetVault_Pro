import React, { useEffect, useMemo, useState } from 'react'
import { formatFileSizeMbFilterLabel } from '@/shared/assetFilters'
import { useApp } from '../../stores/AppContext'
import { findFolderInTree, getChildFolders } from '../../utils/folderTreeNav'
import { FolderIconDisplay } from '../Common/FolderIconDisplay'
import { FontFamilyContextView, FontTypeContextView } from './FontDetailContext'

const FILE_TYPE_META: Record<string, { label: string; emoji: string; desc: string }> = {
  image: { label: 'Images', emoji: '🖼️', desc: '图片与照片类素材' },
  video: { label: 'Videos', emoji: '🎬', desc: '视频文件' },
  audio: { label: 'Audio', emoji: '🎵', desc: '音频文件' },
  font: { label: 'Fonts', emoji: '🔤', desc: '字体文件（TTF / OTF / TTC 等）' },
  design: { label: 'Design', emoji: '🎨', desc: '设计源文件' },
  document: { label: 'Docs', emoji: '📄', desc: '文档与文本' },
  '3d': { label: '3D', emoji: '📦', desc: '三维模型与场景' },
  code: { label: 'Code', emoji: '💻', desc: '代码与脚本' },
  other: { label: 'Other', emoji: '📎', desc: '其他类型' }
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

function FolderContextView({ onClose }: { onClose: () => void }) {
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
      subtitle="文件夹"
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
            <p className="text-xs text-av-text-muted">{folder.assetCount} 个素材</p>
          </div>
        )
      }
    >
      <ContextInfoSection title="文件夹信息">
        <ContextInfoRow label="名称" value={folder.name} />
        <ContextInfoRow label="素材数" value={String(folder.assetCount)} />
        <ContextInfoRow label="子文件夹" value={String(childFolders.length)} />
        <ContextInfoRow label="层级" value={`第 ${folder.level + 1} 级`} />
        <ContextInfoRow label="路径" value={folder.path || '/'} />
        <ContextInfoRow label="创建" value={new Date(folder.createdAt).toLocaleString()} />
        <ContextInfoRow label="更新" value={new Date(folder.updatedAt).toLocaleString()} />
      </ContextInfoSection>
      {childFolders.length > 0 ? (
        <ContextInfoSection title="子文件夹">
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
      <p className="text-[11px] text-av-text-muted leading-relaxed">
        选中素材后可在此查看文件详情；当前显示的是侧栏所选文件夹的概览。
      </p>
    </DetailPanelShell>
  )
}

function TypeContextView({ onClose }: { onClose: () => void }) {
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

  const filters: string[] = []
  if (debouncedSearch.trim()) filters.push(`搜索「${debouncedSearch.trim()}」`)
  if (colorBucketFilter) filters.push(`颜色 ${colorBucketFilter}`)
  if (sizePresetFilter) filters.push(`尺寸 ${sizePresetFilter}`)
  const mbLabel = formatFileSizeMbFilterLabel(fileSizeMinMb, fileSizeMaxMb)
  if (mbLabel) filters.push(`体积 ${mbLabel}`)
  if (datePresetFilter) filters.push(`日期 ${datePresetFilter}`)
  if (tagFilters.length > 0) filters.push(`${tagFilters.length} 个标签筛选`)

  return (
    <DetailPanelShell
      title={meta.label}
      subtitle="类型筛选"
      onClose={onClose}
      preview={
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-av-bg-primary">
          <span className="text-5xl">{meta.emoji}</span>
          <p className="text-sm text-av-text-secondary">{meta.desc}</p>
        </div>
      }
    >
      <ContextInfoSection title="类型信息">
        <ContextInfoRow label="类型 ID" value={fileTypeFilter} />
        <ContextInfoRow label="匹配数量" value={totalAssets.toLocaleString()} />
        {filters.length > 0 ? <ContextInfoRow label="附加筛选" value={filters.join(' · ')} /> : null}
      </ContextInfoSection>
      <p className="text-[11px] text-av-text-muted leading-relaxed">
        侧栏 Types 中再次点击可取消类型筛选，返回资料库概览。
      </p>
    </DetailPanelShell>
  )
}

function LibraryContextView({ onClose }: { onClose: () => void }) {
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
      title={libraryState?.libraryDisplayName ?? '资料库'}
      subtitle="全部资产"
      onClose={onClose}
      preview={
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-av-bg-primary to-av-bg-elevated">
          <span className="text-5xl">🗂</span>
          <p className="text-lg font-semibold text-av-text-primary tabular-nums">
            {totalAssets.toLocaleString()} 项素材
          </p>
        </div>
      }
    >
      <ContextInfoSection title="资料库信息">
        <ContextInfoRow label="名称" value={libraryState?.libraryDisplayName ?? '…'} />
        <ContextInfoRow label="素材总数" value={totalAssets.toLocaleString()} />
        <ContextInfoRow label="文件夹" value={String(folderCount)} />
        <ContextInfoRow label="标签" value={String(tags.length)} />
        {storage ? (
          <>
            <ContextInfoRow label="条目包" value={String(storage.itemPackCount)} />
            <ContextInfoRow label="数据库行" value={String(storage.assetRowCount)} />
          </>
        ) : null}
      </ContextInfoSection>
      {libraryState?.activeLibraryRoot ? (
        <ContextInfoSection title="存储位置">
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
      <p className="text-[11px] text-av-text-muted leading-relaxed">
        未选中素材时显示当前资料库概览；选择文件夹或类型筛选后会显示对应上下文信息。
      </p>
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
