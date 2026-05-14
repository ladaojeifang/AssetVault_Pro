import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useApp } from '../../stores/AppContext'
import { formatFileSize } from '@/shared/types'

const DetailPanel: React.FC = () => {
  const { selectedAssetIds, assets, tags, clearSelection, refreshAssets, setDetailPanelOpen, refreshTags } = useApp()
  const [assetTagIds, setAssetTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const notesDirtyRef = useRef(false)
  const savingNotesRef = useRef(false)

  // Get the first selected asset for detail view
  const selectedAsset = assets.find((a) => selectedAssetIds.has(a.id))

  useEffect(() => {
    if (selectedAsset && (selectedAsset as any).tagIds) {
      setAssetTagIds((selectedAsset as any).tagIds || [])
    } else if (selectedAsset) {
      setAssetTagIds([])
    }
  }, [selectedAsset])

  useEffect(() => {
    if (!selectedAsset) return
    setNotesDraft(selectedAsset.notes ?? '')
    notesDirtyRef.current = false
  }, [selectedAsset?.id])

  if (!selectedAsset) {
    return (
      <div className="flex items-center justify-center h-full text-av-text-muted text-sm">
        Select an asset to view details
      </div>
    )
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
  }

  const saveNotesIfChanged = useCallback(async () => {
    if (!notesDirtyRef.current || savingNotesRef.current) return
    const prev = asset.notes ?? ''
    if (notesDraft === prev) {
      notesDirtyRef.current = false
      return
    }
    savingNotesRef.current = true
    try {
      await window.assetVaultAPI.assets.updateNotes(asset.id, notesDraft)
      notesDirtyRef.current = false
      await refreshAssets()
    } catch (e) {
      console.error('Failed to save notes:', e)
    } finally {
      savingNotesRef.current = false
    }
  }, [asset.id, asset.notes, notesDraft, refreshAssets])

  function openInExplorer() {
    window.assetVaultAPI.fs.openInExplorer(asset.filePath)
  }

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
        {asset.dominantColor && (
          <InfoSection title="Color Analysis">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg border border-av-border"
                style={{ backgroundColor: asset.dominantColor }}
              />
              <div>
                <p className="text-sm font-mono text-av-text-primary">
                  {asset.dominantColor?.toUpperCase()}
                </p>
                <p className="text-xs text-av-text-muted">Dominant color</p>
              </div>
            </div>
          </InfoSection>
        )}

        {/* User remarks */}
        <InfoSection title="备注">
          <textarea
            value={notesDraft}
            onChange={(e) => {
              setNotesDraft(e.target.value)
              notesDirtyRef.current = true
            }}
            onBlur={() => void saveNotesIfChanged()}
            maxLength={16000}
            rows={5}
            placeholder="在此输入对该资产的说明…"
            className="input-base w-full min-h-[100px] py-2 px-2.5 text-sm resize-y text-av-text-primary placeholder:text-av-text-muted leading-relaxed"
          />
          <p className="text-[11px] text-av-text-muted mt-1.5">失焦时自动保存，最多 16000 字</p>
        </InfoSection>
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-av-border space-y-2">
        <button
          onClick={() => window.assetVaultAPI.fs.openInExplorer(asset.filePath)}
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
        <button onClick={handleDelete} className="w-full justify-center text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5">
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

  useEffect(() => {
    let cancelled = false
    if (asset.hasThumbnail) {
      window.assetVaultAPI.assets.getThumbnail(asset.id).then((data) => {
        if (!cancelled && data) setPreviewSrc(data as string)
      })
    }
    return () => {
      cancelled = true
    }
  }, [asset])

  if (previewSrc) {
    return (
      <img src={previewSrc!} alt={asset.filename} className="w-full h-full object-contain" />
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <FilePlaceholder fileType={asset.fileType} color={asset.dominantColor} />
    </div>
  )
}

// Reuse FilePlaceholder from AssetGrid
// We'll need to extract this to a shared component or duplicate it here
function FilePlaceholder({ fileType, color }: { fileType: string; color?: string | null }) {
  const config: Record<string, JSX.Element> = {
    image: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-av-text-muted">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
      </svg>
    ),
    video: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-av-text-muted">
        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    ),
    audio: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-av-text-muted">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
    ),
    font: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-av-text-muted">
        <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
    document: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-av-text-muted">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    design: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-av-text-muted">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    ),
    '3d': (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-av-text-muted">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    code: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-av-text-muted">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    )
  }
  return <div>{config[fileType] || config.document}</div>
}

// Info section helper components
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-av-text-muted">{label}</span>
      <span className="text-av-text-primary font-medium tabular-nums">{value}</span>
    </div>
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
