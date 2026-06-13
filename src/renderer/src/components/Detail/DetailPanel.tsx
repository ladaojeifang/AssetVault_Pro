import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../stores/AppContext'
import { flattenFolderTree } from '../../utils/flattenFolderTree'
import { formatFileSize } from '@/shared/types'
import type { AssetItem } from '@/shared/types'
import type { ParsedFontMetadata, FontFaceSummary } from '@/shared/fontTypes'
import { parseFontMetadataFromAsset } from '../../utils/fontAssetMeta'
import { notify } from '../Common/notify'
import { FolderIconDisplay } from '../Common/FolderIconDisplay'
import { ColorPaletteStrip, parseAssetPaletteColors } from '../Common/ColorPaletteStrip'
import DetailContextPanel from './DetailContextPanel'
import { ModelViewer } from '../Preview/ModelViewer'
import {
  ASSET_PREVIEW_DETAIL_LABEL_KEY,
  canAssetPreview,
  listAssetPreviewKinds
} from '@/shared/assetPreviewRegistry'
import { isSvgExtension, isSvgOverRasterLimit } from '@/shared/svgFormats'
import { openAssetPreview } from '../../utils/openAssetPreview'
import { FileTypePlaceholder } from '../Common/FileTypePlaceholder'
import { DESTRUCTIVE_BUTTON_CLASS } from '../../theme/destructiveActionClasses'

const DetailPanel: React.FC = () => {
  const { t } = useTranslation('detail')
  const { selectedAssetIds, assets, tags, folderTree, clearSelection, refreshAssets, refreshFolders, setDetailPanelOpen, refreshTags, openFontPreview, openModelPreview, openSvgPreview, openExrPreview, openMarkdownPreview } = useApp()
  const [assetTagIds, setAssetTagIds] = useState<string[]>([])
  const [assetFolderIds, setAssetFolderIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const notesDirtyRef = useRef(false)
  const savingNotesRef = useRef(false)
  const [sourceUrlDraft, setSourceUrlDraft] = useState('')
  const sourceUrlDirtyRef = useRef(false)
  const savingSourceUrlRef = useRef(false)
  const [paletteColors, setPaletteColors] = useState<string[]>([])
  const [paletteLoading, setPaletteLoading] = useState(false)

  // Get the first selected asset for detail view
  const selectedAsset = assets.find((a) => selectedAssetIds.has(a.id))

  const folderSyncKey = selectedAsset
    ? `${selectedAsset.id}|${(selectedAsset.folderIds ?? []).slice().sort().join(',')}`
    : ''

  useEffect(() => {
    if (selectedAsset && (selectedAsset as any).tagIds) {
      setAssetTagIds((selectedAsset as any).tagIds || [])
    } else if (selectedAsset) {
      setAssetTagIds([])
    }
  }, [selectedAsset])

  useEffect(() => {
    if (!selectedAsset) {
      setAssetFolderIds([])
      return
    }
    setAssetFolderIds([...(selectedAsset.folderIds ?? [])])
  }, [folderSyncKey, selectedAsset])

  useEffect(() => {
    if (!selectedAsset) return
    setNotesDraft(selectedAsset.notes ?? '')
    notesDirtyRef.current = false
    setSourceUrlDraft(selectedAsset.sourceUrl ?? '')
    sourceUrlDirtyRef.current = false
  }, [selectedAsset?.id])

  useEffect(() => {
    const a = selectedAsset
    if (!a) {
      setPaletteColors([])
      setPaletteLoading(false)
      return
    }
    if (a.fileType !== 'image' && a.fileType !== 'video') {
      setPaletteColors([])
      setPaletteLoading(false)
      return
    }

    const existing = parseAssetPaletteColors(a.colors, a.dominantColor)
    if (existing.length >= 10) {
      setPaletteColors(existing)
      setPaletteLoading(false)
      return
    }

    if (isSvgExtension(a.extension) && isSvgOverRasterLimit(a.fileSize)) {
      setPaletteColors(existing.length > 0 ? existing : parseAssetPaletteColors(a.colors, a.dominantColor))
      setPaletteLoading(false)
      return
    }

    let cancelled = false
    setPaletteLoading(true)
    void window.assetVaultAPI.assets.analyzeColors(a.id).then((res) => {
      if (cancelled) return
      const data = res as { dominantColor?: string; colors?: string[] } | null
      if (data?.colors?.length) {
        setPaletteColors(data.colors.map((c) => c.toUpperCase()))
        void refreshAssets()
      } else {
        setPaletteColors(parseAssetPaletteColors(a.colors, data?.dominantColor ?? a.dominantColor))
      }
      setPaletteLoading(false)
    }).catch(() => {
      if (!cancelled) {
        setPaletteColors(existing.length > 0 ? existing : parseAssetPaletteColors(a.colors, a.dominantColor))
        setPaletteLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedAsset?.id, selectedAsset?.colors, selectedAsset?.dominantColor, selectedAsset?.fileType])

  const saveNotesIfChanged = useCallback(async () => {
    const sel = assets.find((a) => selectedAssetIds.has(a.id))
    if (!sel) return
    if (!notesDirtyRef.current || savingNotesRef.current) return
    const prev = sel.notes?.trim() ?? ''
    if (notesDraft.trim() === prev) {
      notesDirtyRef.current = false
      return
    }
    savingNotesRef.current = true
    try {
      await window.assetVaultAPI.assets.updateNotes(sel.id, notesDraft)
      notesDirtyRef.current = false
      await refreshAssets()
    } catch (e) {
      console.error('Failed to save notes:', e)
    } finally {
      savingNotesRef.current = false
    }
  }, [assets, selectedAssetIds, notesDraft, refreshAssets])

  const saveSourceUrlIfChanged = useCallback(async () => {
    const sel = assets.find((a) => selectedAssetIds.has(a.id))
    if (!sel) return
    if (!sourceUrlDirtyRef.current || savingSourceUrlRef.current) return
    const prev = sel.sourceUrl ?? ''
    if (sourceUrlDraft.trim() === prev.trim()) {
      sourceUrlDirtyRef.current = false
      return
    }
    savingSourceUrlRef.current = true
    try {
      await window.assetVaultAPI.assets.updateSourceUrl(sel.id, sourceUrlDraft.trim() || null)
      sourceUrlDirtyRef.current = false
      await refreshAssets()
    } catch (e: any) {
      console.error('Failed to save source URL:', e)
      notify.error(e?.message ?? t('saveLinkFailed'))
    } finally {
      savingSourceUrlRef.current = false
    }
  }, [assets, selectedAssetIds, sourceUrlDraft, refreshAssets])

  if (!selectedAsset) {
    return <DetailContextPanel onClose={() => setDetailPanelOpen(false)} />
  }

  const asset = selectedAsset

  async function handleAssignTag(tagId: string) {
    try {
      setLoading(true)
      await window.assetVaultAPI.tags.assignToAssets([asset.id], [tagId])
      setAssetTagIds((prev) => [...prev.filter((t) => t !== tagId), tagId])
      await refreshAssets()
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveTag(tagId: string) {
    try {
      setLoading(true)
      await window.assetVaultAPI.tags.removeFromAssets([asset.id], [tagId])
      setAssetTagIds((prev) => prev.filter((t) => t !== tagId))
      await refreshAssets()
    } finally {
      setLoading(false)
    }
  }

  async function handleAssignFolder(folderId: string) {
    try {
      setLoading(true)
      await window.assetVaultAPI.assets.addToFolders([asset.id], [folderId])
      setAssetFolderIds((prev) => [...prev.filter((f) => f !== folderId), folderId])
      await refreshAssets()
      await refreshFolders()
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveFolder(folderId: string) {
    try {
      setLoading(true)
      await window.assetVaultAPI.assets.removeFromFolders([asset.id], [folderId])
      setAssetFolderIds((prev) => prev.filter((f) => f !== folderId))
      await refreshAssets()
      await refreshFolders()
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTag() {
    const name = newTagName.trim()
    if (!name) return
    try {
      setLoading(true)
      const newTag = await window.assetVaultAPI.tags.create({ name })
      await refreshTags()
      await handleAssignTag(newTag.id)
      setNewTagName('')
      setShowTagInput(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${asset.filename}"?`)) return
    await window.assetVaultAPI.assets.delete([asset.id])
    clearSelection()
    await refreshAssets()
    await refreshFolders()
  }

  function openInExplorer() {
    void window.assetVaultAPI.fs.openAssetItemDirectory(asset.id)
  }

  const flatFolders = flattenFolderTree(folderTree)
  const folderById = new Map(flatFolders.map((f) => [f.id, f]))

  return (
    <div className="h-full flex flex-col bg-av-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-av-border">
        <span className="text-sm font-semibold truncate flex-1 mr-2">{asset.filename}</span>
        <button
          onClick={() => setDetailPanelOpen(false)}
          className="btn-icon"
          title="Close panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Preview area */}
      <div className="relative w-full aspect-video bg-av-bg-primary overflow-hidden">
        <DetailPreview asset={asset} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide">
        {/* File info */}
        <InfoSection title="File Information">
          <InfoRow label="Asset ID" value={asset.id} variant="block" />
          <InfoRow label="Type" value={asset.fileType} />
          <InfoRow label="Size" value={formatFileSize(asset.fileSize)} />
          {asset.width && asset.height && (
            <InfoRow
              label="Dimensions"
              value={`${asset.width} x ${asset.height} px`}
            />
          )}
          {asset.duration && <InfoRow label="Duration" value={`${asset.duration.toFixed(1)}s`} />}
          <InfoRow
            label="Imported"
            value={new Date(asset.importedAt).toLocaleString()}
          />
          <InfoRow label="Views" value={String(asset.viewCount)} />
          <InfoRow
            label={t('storage')}
            value={
              asset.storageMode === 'referenced'
                ? asset.sourceMissing
                  ? t('storageRefMissing')
                  : t('storageRefOnly')
                : t('storageLocal')
            }
          />
          {asset.storageMode === 'referenced' && (
            <InfoRow label={t('sourcePath')} value={asset.resolvedFilePath ?? asset.filePath} variant="block" />
          )}
        </InfoSection>

        {listAssetPreviewKinds(asset).map((kind) => (
          <button
            key={kind}
            type="button"
            className="w-full btn-primary text-sm py-2"
            onClick={() =>
              openAssetPreview(kind, asset.id, {
                openFontPreview,
                openModelPreview,
                openSvgPreview,
                openExrPreview,
                openMarkdownPreview
              })
            }
          >
            {t(ASSET_PREVIEW_DETAIL_LABEL_KEY[kind])}
          </button>
        ))}

        {asset.fileType === 'font' && (
          <FontDetailSection asset={asset} onRefresh={() => void refreshAssets()} />
        )}
        <InfoSection title={t('foldersSection')}>
          <p className="text-[11px] text-av-text-muted mb-2 leading-relaxed">
            {t('foldersHint')}
          </p>
          <div className="space-y-2">
            {assetFolderIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {assetFolderIds.map((fid) => {
                  const meta = folderById.get(fid)
                  const label = meta?.name ?? fid.slice(0, 8)
                  return (
                    <FolderChip
                      key={fid}
                      name={label}
                      color={meta?.color ?? '#64748b'}
                      icon={meta?.icon}
                      onRemove={() => void handleRemoveFolder(fid)}
                    />
                  )
                })}
              </div>
            )}
            <div className="flex gap-1.5">
              <select
                className="input-base py-1 text-xs flex-1"
                disabled={loading}
                onChange={(e) => {
                  const v = e.target.value
                  if (v) {
                    void handleAssignFolder(v)
                  }
                  e.target.value = ''
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  {t('addFolder')}
                </option>
                {flatFolders
                  .filter((f) => !assetFolderIds.includes(f.id))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {`${'  '.repeat(f.depth)}${f.name}`}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </InfoSection>

        {/* Tags */}
        <InfoSection title="Tags">
          <div className="space-y-2">
            {/* Assigned tags */}
            {assetTagIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {assetTagIds.map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId)
                  if (!tag) return null
                  return (
                    <TagChip
                      key={tag.id}
                      tag={tag}
                      onRemove={() => handleRemoveTag(tag.id)}
                    />
                  )
                })}
              </div>
            )}

            {/* Add tag dropdown or create new */}
            <div className="flex gap-1.5">
              {showTagInput ? (
                <>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateTag()
                      if (e.key === 'Escape') {
                        setShowTagInput(false)
                        setNewTagName('')
                      }
                    }}
                    placeholder="Tag name..."
                    className="input-base py-1 text-xs flex-1"
                    autoFocus
                  />
                  <button
                    onClick={handleCreateTag}
                    className="btn-primary py-1 px-2 text-xs"
                    disabled={loading || !newTagName.trim()}
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowTagInput(false)
                      setNewTagName('')
                    }}
                    className="btn-secondary py-1 px-2 text-xs"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <select
                    className="input-base py-1 text-xs flex-1"
                    onChange={(e) => {
                      if (e.target.value === '__create__') {
                        setShowTagInput(true)
                      } else if (e.target.value) {
                        handleAssignTag(e.target.value)
                      }
                      e.target.value = ''
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Add tag...</option>
                    {tags
                      .filter((t) => !assetTagIds.includes(t.id))
                      .map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    <option value="__create__">+ Create new tag</option>
                  </select>
                </>
              )}
            </div>
          </div>
        </InfoSection>

        {/* Color info */}
        {(asset.fileType === 'image' || asset.fileType === 'video') && (
          <InfoSection title="COLOR ANALYSIS">
            {paletteLoading && paletteColors.length === 0 ? (
              <p className="text-xs text-av-text-muted">{t('analyzingColors')}</p>
            ) : paletteColors.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <ColorPaletteStrip colors={paletteColors} />
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg border border-av-border shrink-0"
                    style={{ backgroundColor: paletteColors[0] }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-av-text-primary truncate">
                      {paletteColors[0]}
                    </p>
                    <p className="text-xs text-av-text-muted">Dominant color</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-av-text-muted">{t('noColorInfo')}</p>
            )}
          </InfoSection>
        )}

        {/* User remarks */}
        <InfoSection title={t('notes')}>
          <textarea
            value={notesDraft}
            onChange={(e) => {
              setNotesDraft(e.target.value)
              notesDirtyRef.current = true
            }}
            onBlur={() => void saveNotesIfChanged()}
            maxLength={16000}
            rows={5}
            placeholder={t('notesPlaceholder')}
            className="input-base w-full min-h-[100px] py-2 px-2.5 text-sm resize-y text-av-text-primary placeholder:text-av-text-muted leading-relaxed"
          />
          <p className="text-[11px] text-av-text-muted mt-1.5">{t('notesHint')}</p>
        </InfoSection>

        {/* Source URL */}
        <InfoSection title="SOURCE LINK">
          <p className="text-[11px] text-av-text-muted mb-2 leading-relaxed">
            {t('sourceUrlHint')}
          </p>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={sourceUrlDraft}
              onChange={(e) => {
                setSourceUrlDraft(e.target.value)
                sourceUrlDirtyRef.current = true
              }}
              onBlur={() => void saveSourceUrlIfChanged()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void saveSourceUrlIfChanged();
                  (e.target as HTMLInputElement).blur()
                }
              }}
              placeholder="https://example.com"
              maxLength={2048}
              className="input-base py-1.5 px-2.5 text-xs flex-1 text-av-text-primary placeholder:text-av-text-muted"
            />
            {sourceUrlDraft.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const url = sourceUrlDraft.trim()
                  if (/^https?:\/\/.+/i.test(url)) {
                    window.open(url, '_blank', 'noopener,noreferrer')
                  } else {
                    notify.error(t('urlInvalid'))
                  }
                }}
                className="btn-secondary py-1 px-2.5 text-xs shrink-0 flex items-center gap-1"
                title={t('openLink')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
                {t('openLink')}
              </button>
            )}
          </div>
        </InfoSection>
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-av-border space-y-2">
        {asset.storageMode === 'referenced' && (
          <>
            <button
              type="button"
              disabled={asset.sourceMissing}
              className="btn-primary w-full justify-center text-xs disabled:opacity-50"
              onClick={async () => {
                const r = await window.assetVaultAPI.assets.localize([asset.id])
                if (r.localized > 0) {
                  notify.success(t('localized'))
                  await refreshAssets()
                } else if (r.errors[0]) {
                  notify.error(r.errors[0].reason)
                }
              }}
            >
              {t('localize')}
            </button>
            {asset.sourceMissing && (
              <button
                type="button"
                className="btn-secondary w-full justify-center text-xs"
                onClick={async () => {
                  const p = await window.assetVaultAPI.fs.selectDialog({ multi: false })
                  const path = (p as string[])[0]
                  if (!path) return
                  const res = await window.assetVaultAPI.assets.relink(asset.id, path)
                  if (res.ok) {
                    notify.success(t('relinked'))
                    await refreshAssets()
                  } else notify.error(res.error)
                }}
              >
                {t('relink')}
              </button>
            )}
          </>
        )}
        <button
          onClick={() =>
            window.assetVaultAPI.fs.openInExplorer(asset.resolvedFilePath ?? asset.filePath)
          }
          className="btn-secondary w-full justify-center text-xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
          Open
        </button>
        <button onClick={openInExplorer} className="btn-secondary w-full justify-center text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          Show in Explorer
        </button>
        <button
          onClick={handleDelete}
          className={`w-full justify-center text-xs rounded-md px-3 py-1.5 flex items-center gap-1.5 ${DESTRUCTIVE_BUTTON_CLASS}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          Delete Asset
        </button>
      </div>
    </div>
  )
}

// Preview component inside detail panel
function DetailPreview({ asset }: { asset: any }) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [modelFileUrl, setModelFileUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setModelFileUrl(null)
    setPreviewSrc(null)

    if (canAssetPreview(asset, 'model')) {
      void (async () => {
        const target = asset.resolvedFilePath ?? asset.filePath
        const href = await window.assetVaultAPI.fs.pathToFileUrl(target)
        if (!cancelled && href) setModelFileUrl(href)
      })()
      void window.assetVaultAPI.assets.getThumbnail(asset.id).then((data) => {
        if (!cancelled && data) setPreviewSrc(data as string)
      })
      return () => {
        cancelled = true
      }
    }

    if (asset.fileType === '3d') {
      return () => {
        cancelled = true
      }
    }

    if (asset.hasThumbnail || asset.fileType === 'image' || asset.fileType === 'video' || asset.fileType === 'font') {
      void window.assetVaultAPI.assets.getThumbnail(asset.id).then((data) => {
        if (!cancelled && data) setPreviewSrc(data as string)
      })
    }
    return () => {
      cancelled = true
    }
  }, [asset.id, asset.fileType, asset.filePath, asset.resolvedFilePath])

  if (canAssetPreview(asset, 'model') && modelFileUrl) {
    return (
      <ModelViewer
        fileUrl={modelFileUrl}
        extension={asset.extension}
        className="w-full h-full min-h-[220px]"
      />
    )
  }

  if (previewSrc) {
    return <img src={previewSrc} alt={asset.filename} className="w-full h-full object-contain" />
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <FileTypePlaceholder
        fileType={asset.fileType}
        extension={asset.extension}
        color={asset.dominantColor}
        size="lg"
      />
    </div>
  )
}

// Info section helper components
function FontDetailSection({
  asset,
  onRefresh
}: {
  asset: AssetItem
  onRefresh: () => void
}) {
  const { t } = useTranslation('detail')
  const font = parseFontMetadataFromAsset(asset)
  const [faces, setFaces] = useState<FontFaceSummary[]>([])
  const [faceBusy, setFaceBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    if (!font?.ttcFaceCount || font.ttcFaceCount <= 1) {
      setFaces([])
      return
    }
    void window.assetVaultAPI.fonts.listFaces(asset.id).then(setFaces)
  }, [asset.id, font?.ttcFaceCount])

  if (!font) return null

  const onFaceChange = async (index: number) => {
    setFaceBusy(true)
    try {
      const res = await window.assetVaultAPI.fonts.updateFaceIndex(asset.id, index, true)
      if (!res.ok) notify.error(res.error)
      else {
        notify.success(t('ttcSwitched'))
        onRefresh()
      }
    } finally {
      setFaceBusy(false)
    }
  }

  const install = async () => {
    setActionBusy(true)
    try {
      const res = await window.assetVaultAPI.fonts.installToSystem(asset.id)
      if (res.ok)
        notify.success(res.dest ? t('installedTo', { dest: res.dest }) : t('installedUserFont'))
      else notify.error(res.error)
    } finally {
      setActionBusy(false)
    }
  }

  const exportCopy = async () => {
    setActionBusy(true)
    try {
      const res = await window.assetVaultAPI.fonts.exportCopy(asset.id)
      if (res.ok) notify.success(t('exportedTo', { path: res.path }))
      else if (res.error !== 'cancelled') notify.error(res.error)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-xs flex-1" disabled={actionBusy} onClick={() => void install()}>
          {t('installSystem')}
        </button>
        <button type="button" className="btn-secondary text-xs flex-1" disabled={actionBusy} onClick={() => void exportCopy()}>
          {t('exportCopy')}
        </button>
        <button
          type="button"
          className="btn-secondary text-xs w-full"
          disabled={actionBusy}
          onClick={() => void window.assetVaultAPI.fonts.openItemFolder(asset.id)}
        >
          {t('openFontDir')}
        </button>
      </div>
      <FontInfoSection font={font} faces={faces} faceBusy={faceBusy} onFaceChange={(i) => void onFaceChange(i)} />
    </>
  )
}

function FontInfoSection({
  font,
  faces,
  faceBusy,
  onFaceChange
}: {
  font: ParsedFontMetadata
  faces: FontFaceSummary[]
  faceBusy?: boolean
  onFaceChange?: (index: number) => void
}) {
  const { t } = useTranslation('detail')
  const cov = font.unicodeCoverage

  return (
    <InfoSection title="Font">
      <InfoRow label="Family" value={font.familyName} />
      {font.subfamilyName ? <InfoRow label="Subfamily" value={font.subfamilyName} /> : null}
      {font.postscriptName ? <InfoRow label="PostScript" value={font.postscriptName} /> : null}
      <InfoRow label="Glyphs" value={String(font.glyphCount)} />
      <InfoRow label="Units/em" value={String(font.unitsPerEm)} />
      {font.ttcFaceCount != null && font.ttcFaceCount > 1 ? (
        <>
          <InfoRow label="TTC faces" value={String(font.ttcFaceCount)} />
          {faces.length > 0 && onFaceChange ? (
            <div className="pt-1">
              <label className="text-[11px] text-av-text-muted block mb-1">{t('currentWeight')}</label>
              <select
                className="input-base py-1 text-xs w-full"
                disabled={faceBusy}
                value={font.ttcIndex ?? 0}
                onChange={(e) => onFaceChange(Number(e.target.value))}
              >
                {faces.map((f) => (
                  <option key={f.index} value={f.index}>
                    {f.subfamilyName || f.fullName || `#${f.index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <InfoRow label="Active face" value={`#${(font.ttcIndex ?? 0) + 1}`} />
          )}
        </>
      ) : null}
      {cov ? (
        <div className="pt-1 space-y-0.5">
          <p className="text-[11px] text-av-text-muted">{t('unicodeCoverage')}</p>
          <InfoRow label="Total" value={String(cov.totalCodePoints)} />
          <InfoRow label="Latin" value={String(cov.latinBasic + cov.latinExtended)} />
          <InfoRow label="CJK" value={String(cov.cjkUnified)} />
          <InfoRow label="Digits" value={String(cov.digits)} />
        </div>
      ) : null}
      {font.variationAxes && font.variationAxes.length > 0 ? (
        <div className="pt-1">
          <p className="text-[11px] text-av-text-muted mb-1">{t('variableAxes')}</p>
          {font.variationAxes.map((a) => (
            <p key={a.tag} className="text-[11px] text-av-text-secondary font-mono">
              {a.name} ({a.tag}) {a.min}–{a.max} default {a.default}
            </p>
          ))}
        </div>
      ) : null}
      {font.sampleGlyphs.length > 0 ? (
        <div className="pt-1">
          <p className="text-[11px] text-av-text-muted mb-1">Sample glyphs · {font.sampleText}</p>
          <div className="space-y-1">
            {font.sampleGlyphs.map((g, idx) => (
              <p key={`glyph-${idx}-${g.codePoint}-${g.id}`} className="text-[11px] text-av-text-secondary font-mono">
                {g.char} id={g.id} advance={Math.round(g.advanceWidth)}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </InfoSection>
  )
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-av-text-muted uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  variant = 'inline'
}: {
  label: string
  value: string
  variant?: 'inline' | 'block'
}) {
  if (variant === 'block') {
    return (
      <div className="text-sm space-y-1">
        <span className="text-av-text-muted">{label}</span>
        <p className="text-av-text-primary font-mono text-[11px] leading-snug break-all select-all">
          {value}
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between text-sm gap-2">
      <span className="text-av-text-muted shrink-0">{label}</span>
      <span className="text-av-text-primary font-medium tabular-nums text-right min-w-0">{value}</span>
    </div>
  )
}

function FolderChip({
  name,
  color,
  icon,
  onRemove
}: {
  name: string
  color: string
  icon?: string | null
  onRemove: () => void
}) {
  const { t } = useTranslation('detail')
  return (
    <span
      className="inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-md text-xs border"
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}18`,
        color: 'var(--color-text-primary, #e2e8f0)'
      }}
    >
      <FolderIconDisplay icon={icon} accentColor={color} size={13} className="shrink-0" />
      <span className="truncate font-medium">{name}</span>
      <button type="button" onClick={onRemove} className="shrink-0 opacity-70 hover:opacity-100" title={t('removeFromFolder')}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2 2l6 6M8 2L2 8" />
        </svg>
      </button>
    </span>
  )
}

function TagChip({
  tag,
  onRemove
}: {
  tag: any
  onRemove: () => void
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium`}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        border: `1px solid ${tag.color}40`
      }}
    >
      {tag.name}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2 2l6 6M8 2l-6 6" />
        </svg>
      </button>
    </span>
  )
}

export default DetailPanel
