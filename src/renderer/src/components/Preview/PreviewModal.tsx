import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { AssetItem } from '@/shared/types'
import { FONT_THUMB_SAMPLE_TEXT } from '@/shared/fontTypes'
import { ModelViewer } from './ModelViewer'
import { useFontFace } from '../../hooks/useFontFace'
import { fontFamilyLabel, parseFontMetadataFromAsset } from '../../utils/fontAssetMeta'

interface PreviewModalProps {
  asset: AssetItem | null
  isOpen: boolean
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
}

/**
 * Multi-format Preview Modal
 * Supports: Image, Video, Audio, Font preview, Code highlighting
 */
const PreviewModal: React.FC<PreviewModalProps> = ({
  asset,
  isOpen,
  onClose,
  onNext,
  onPrev
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [modelFileUrl, setModelFileUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!asset || !isOpen) {
      setPreviewUrl(null)
      setModelFileUrl(null)
      return
    }

    loadPreview()
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [asset?.id, isOpen])

  async function loadPreview() {
    if (!asset) return

    setLoading(true)
    setModelFileUrl(null)
    try {
      if (asset.fileType === 'image') {
        const thumbData = await window.assetVaultAPI.assets.getThumbnail(asset.id)
        setPreviewUrl(thumbData as string ?? null)
      } else if (asset.fileType === '3d') {
        const target = asset.resolvedFilePath ?? asset.filePath
        const href = await window.assetVaultAPI.fs.pathToFileUrl(target)
        setModelFileUrl(href)
        setPreviewUrl(null)
      } else if (['video', 'audio'].includes(asset.fileType)) {
        setPreviewUrl(null)
      } else {
        setPreviewUrl(null)
      }
    } catch (error) {
      console.error('Preview load error:', error)
      setPreviewUrl(null)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && onNext) onNext()
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
    },
    [onClose, onNext, onPrev]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen || !asset) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-fade-in" onClick={onClose}>
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation buttons */}
      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Preview content area */}
      <div
        className={`max-w-[90vw] max-h-[85vh] flex items-center justify-center ${loading ? '' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-4 text-white/60">
            <div className="w-16 h-16 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Loading preview...</span>
          </div>
        ) : (
          renderContent(asset, previewUrl, modelFileUrl)
        )}
      </div>

      {/* Info bar at bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-xl bg-black/60 backdrop-blur-sm text-white/80 text-sm">
        <span className="font-medium">{asset.filename}</span>
        <span className="text-white/40">|</span>
        <span>{asset.width && asset.height ? `${asset.width} x ${asset.height}px` : ''}</span>
        <span className="text-white/40">|</span>
        <span>{formatSize(asset.fileSize)}</span>
      </div>
    </div>
  )
}

function renderContent(
  currentAsset: AssetItem,
  previewUrl: string | null,
  modelFileUrl: string | null
) {
  if (!currentAsset) return null

  switch (currentAsset.fileType) {
    case 'image':
      return previewUrl ? (
        <img
          src={previewUrl!}
          alt={currentAsset.filename}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
      ) : (
        <ImagePlaceholder asset={currentAsset} />
      )

    case 'video':
      return <VideoPlaceholder asset={currentAsset} />

    case 'audio':
      return <AudioPlaceholder asset={currentAsset} />

    case 'font':
      return <FontPreview asset={currentAsset} />

    case '3d':
      return modelFileUrl ? (
        <div className="w-[min(90vw,960px)] h-[min(80vh,720px)]">
          <ModelViewer
            fileUrl={modelFileUrl}
            extension={currentAsset.extension}
            className="w-full h-full"
          />
        </div>
      ) : (
        <FilePreviewPlaceholder asset={currentAsset} />
      )

    default:
      return <FilePreviewPlaceholder asset={currentAsset} />
  }
}

function ImagePlaceholder({ asset }: { asset: AssetItem }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="w-64 h-64 rounded-lg bg-white/5 flex items-center justify-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-white/30">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
        </svg>
      </div>
      <p className="text-white/50 text-sm">Image preview not available</p>
      <p className="text-white/30 text-xs break-all">{asset.resolvedFilePath ?? asset.filePath}</p>
    </div>
  )
}

function VideoPlaceholder({ asset }: { asset: AssetItem }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8 min-w-[400px]">
      <div className="w-96 h-56 rounded-lg bg-gradient-to-br from-purple-900/40 to-violet-800/30 flex items-center justify-center relative overflow-hidden group cursor-pointer">
        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <polygon points="8 5 19 12 8 19" />
          </svg>
        </div>
        <p className="absolute bottom-3 left-3 text-white/50 text-xs">
          Video preview requires FFmpeg integration
        </p>
      </div>
      <p className="text-white/70 font-medium">{asset.filename}</p>
      {asset.duration && <p className="text-white/40 text-xs">Duration: {asset.duration.toFixed(1)}s</p>}
    </div>
  )
}

function AudioPlaceholder({ asset }: { asset: AssetItem }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8 min-w-[360px]">
      <div className="w-72 h-36 rounded-xl bg-gradient-to-br from-pink-900/40 to-rose-800/30 p-6 flex flex-col items-center justify-center gap-3">
        <div className="flex items-end gap-1 h-12">
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-white/30 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1}s`,
                animationDuration: `${0.5 + Math.random() * 0.5}s`
              }}
            />
          ))}
        </div>
        <p className="text-white/50 text-xs">Audio waveform visualization</p>
      </div>
      <p className="text-white/70">{asset.filename}</p>
      {asset.duration && <p className="text-white/40 text-xs">Duration: {asset.duration.toFixed(1)}s</p>}
    </div>
  )
}

function FontPreview({ asset }: { asset: AssetItem }) {
  const meta = useMemo(() => parseFontMetadataFromAsset(asset), [asset])
  const familyLabel = fontFamilyLabel(asset, meta)
  const { familyName, loaded: fontLoaded } = useFontFace(asset)

  const sampleText = useMemo(() => {
    return meta?.sampleText?.trim() || FONT_THUMB_SAMPLE_TEXT
  }, [meta])

  return (
    <div className="flex flex-col items-center gap-4 p-8 min-w-[500px]">
      <div className="w-full rounded-xl bg-white/5 p-8 space-y-4">
        <div style={{ fontFamily: `'${familyName}', '${familyLabel}', sans-serif` }}>
          <p className="text-5xl text-white mb-4 text-center">
            {fontLoaded ? sampleText : 'Loading Font...'}
          </p>
          <p className="text-3xl text-white/90 mb-4 text-center">
            {fontLoaded ? 'The quick brown fox jumps over the lazy dog. 1234567890!' : ''}
          </p>
          <p className="text-xl text-white/70 text-center">
            {fontLoaded
              ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 !@#$%'
              : ''}
          </p>
        </div>
        <p className="text-white/40 text-xs mt-4 pt-4 border-t border-white/10 text-center">
          {familyLabel} · {formatSize(asset.fileSize)}
        </p>
      </div>
    </div>
  )
}

function FilePreviewPlaceholder({ asset }: { asset: AssetItem }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="w-48 h-48 rounded-lg bg-white/5 flex items-center justify-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-white/30">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <p className="text-white/70">{asset.filename}</p>
      <p className="text-white/40 text-sm">Type: {asset.fileType.toUpperCase()}</p>
      <p className="text-white/30 text-xs break-all">{asset.resolvedFilePath ?? asset.filePath}</p>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export default PreviewModal
