import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssetItem } from '@/shared/types'
import { formatFileSize } from '@/shared/types'
import { isSvgExtension } from '@/shared/svgFormats'
import { canAssetPreview } from '@/shared/assetPreviewRegistry'
import { useApp } from '../../stores/AppContext'
import { loadSvgPreviewObjectUrl, revokeSvgPreviewObjectUrl } from '../../utils/loadSvgPreviewUrl'
import { DESTRUCTIVE_MESSAGE_CLASS } from '../../theme/destructiveActionClasses'

interface SvgPreviewPageProps {
  assetId: string
}

const MIN_SCALE = 0.1
const MAX_SCALE = 32

const SvgPreviewPage: React.FC<SvgPreviewPageProps> = ({ assetId }) => {
  const { t } = useTranslation('preview')
  const { assets, closeSvgPreview } = useApp()
  const [asset, setAsset] = useState<AssetItem | null>(() => assets.find((a) => a.id === assetId) ?? null)
  const [loadingAsset, setLoadingAsset] = useState(!asset)
  const [svgFileUrl, setSvgFileUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  const ext = useMemo(() => asset?.extension ?? '', [asset?.extension])
  const isSvg = isSvgExtension(ext)

  useEffect(() => {
    let cancelled = false
    const cached = assets.find((a) => a.id === assetId)
    if (cached) {
      setAsset(cached)
      setLoadingAsset(false)
    } else {
      setLoadingAsset(true)
      void window.assetVaultAPI.assets
        .getById(assetId)
        .then((row) => {
          if (!cancelled) setAsset(row as AssetItem | null)
        })
        .finally(() => {
          if (!cancelled) setLoadingAsset(false)
        })
    }
    return () => {
      cancelled = true
    }
  }, [assetId, assets])

  useEffect(() => {
    setSvgFileUrl(null)
    setLoadError(null)
    setScale(1)
    setOffset({ x: 0, y: 0 })

    if (!asset || !isSvg) return

    let cancelled = false
    void (async () => {
      const target = asset.resolvedFilePath ?? asset.filePath
      if (!target) {
        if (!cancelled) setLoadError(t('pathResolveFailed'))
        return
      }
      const href = await loadSvgPreviewObjectUrl(target)
      if (cancelled) {
        revokeSvgPreviewObjectUrl(href)
        return
      }
      if (href) setSvgFileUrl(href)
      else setLoadError(t('svg.loadFailed'))
    })()

    return () => {
      cancelled = true
    }
  }, [asset?.id, asset?.filePath, asset?.resolvedFilePath, isSvg, t])

  useEffect(() => {
    return () => {
      revokeSvgPreviewObjectUrl(svgFileUrl)
    }
  }, [svgFileUrl])

  const handleBack = useCallback(() => closeSvgPreview(), [closeSvgPreview])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleBack])

  const resetView = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * delta)))
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [offset.x, offset.y]
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    setOffset({
      x: d.ox + (e.clientX - d.x),
      y: d.oy + (e.clientY - d.y)
    })
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  if (loadingAsset) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-av-text-muted">
        {t('loadingAsset')}
      </div>
    )
  }

  if (!asset || !canAssetPreview(asset, 'svg')) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-av-text-secondary">
        <p>{t('notFoundSvg')}</p>
        <button type="button" className="btn-secondary text-sm" onClick={handleBack}>
          {t('backToLibrary')}
        </button>
      </div>
    )
  }

  const dimLabel =
    asset.width && asset.height ? `${asset.width} × ${asset.height}` : t('svg.vectorScalable')

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-av-bg-primary">
      <header className="flex items-center gap-3 px-4 h-12 border-b border-av-border bg-av-bg-secondary shrink-0">
        <button type="button" className="btn-ghost p-2 rounded-lg" onClick={handleBack} title={t('backTitle')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-av-text-primary truncate">{asset.filename}</h1>
          <p className="text-[11px] text-av-text-muted truncate">
            SVG · {formatFileSize(asset.fileSize)} · {dimLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-av-text-muted tabular-nums w-12 text-right">
            {Math.round(scale * 100)}%
          </span>
          <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={resetView}>
            {t('resetView')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div
          ref={viewportRef}
          className="flex-1 min-w-0 relative overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            backgroundColor: '#1a1d26',
            backgroundImage:
              'linear-gradient(45deg, #252837 25%, transparent 25%), linear-gradient(-45deg, #252837 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #252837 75%), linear-gradient(-45deg, transparent 75%, #252837 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0'
          }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {loadError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-av-text-muted px-6 text-center">
              <p>{loadError}</p>
              {asset.sourceMissing ? (
                <p className={`text-xs ${DESTRUCTIVE_MESSAGE_CLASS}`}>{t('svg.sourceMissing')}</p>
              ) : null}
            </div>
          ) : svgFileUrl ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: 'center center'
              }}
            >
              <img
                src={svgFileUrl}
                alt={asset.filename}
                className="max-w-[min(90vw,1200px)] max-h-[min(80vh,900px)] w-auto h-auto object-contain select-none pointer-events-none shadow-2xl"
                draggable={false}
                onError={() => setLoadError(t('svg.renderFailed'))}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-av-text-muted">
              {t('loadingSvg')}
            </div>
          )}
        </div>

        <aside className="w-52 shrink-0 border-l border-av-border bg-av-bg-secondary p-4 space-y-4 overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold text-av-text-muted uppercase tracking-wider mb-2">
              {t('svg.controlsSection')}
            </h3>
            <ul className="text-[11px] text-av-text-secondary space-y-1.5 leading-relaxed">
              <li>{t('svg.controlsZoom')}</li>
              <li>{t('svg.controlsPan')}</li>
              <li>{t('svg.controlsBack')}</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-av-text-muted uppercase tracking-wider mb-2">
              {t('svg.aboutSection')}
            </h3>
            <p className="text-[11px] text-av-text-secondary leading-relaxed">{t('svg.aboutDesc')}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default SvgPreviewPage
