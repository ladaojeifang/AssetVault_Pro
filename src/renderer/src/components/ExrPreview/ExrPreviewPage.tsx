import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AssetItem } from '@/shared/types'
import { formatFileSize } from '@/shared/types'
import type { ExrChannelToggle, ExrFileMetadata, ExrLayerInfo } from '@/shared/exrTypes'
import {
  EXR_DEFAULT_LAYER_NAME,
  EXR_PREVIEW_DEFAULT_EXPOSURE,
  EXR_PREVIEW_MAX_EXPOSURE,
  EXR_PREVIEW_MIN_EXPOSURE
} from '@/shared/exrTypes'
import type { ExrAovDisplayMode } from '@/shared/exrAovDisplay'
import { exposureAppliesToDisplayMode } from '@/shared/exrAovDisplay'
import { formatExrPreviewError } from '@/shared/exrPreviewErrors'
import { partitionExrLayerChannelSuffixes } from '@/shared/exrLayerGrouping'
import { isExrExtension } from '@/shared/exrFormats'
import { useApp } from '../../stores/AppContext'
import { useTranslation } from 'react-i18next'
import { DESTRUCTIVE_MESSAGE_CLASS } from '../../theme/destructiveActionClasses'

interface ExrPreviewPageProps {
  assetId: string
}

const MIN_SCALE = 0.1
const MAX_SCALE = 16

const LAYER_CHANNEL_DEBOUNCE_MS = 180
const EXPOSURE_DEBOUNCE_MS = 400

const DEFAULT_CHANNELS: ExrChannelToggle = { r: true, g: true, b: true, a: false }

function channelsKey(ch: ExrChannelToggle): string {
  return `${ch.r ? 1 : 0}${ch.g ? 1 : 0}${ch.b ? 1 : 0}${ch.a ? 1 : 0}`
}

function channelLabel(suffix: string): string {
  return suffix.toUpperCase()
}

function defaultToggleForLayer(layer: ExrLayerInfo): ExrChannelToggle {
  const { toggleable } = partitionExrLayerChannelSuffixes(layer.channels)
  if (toggleable.length === 0) {
    return { r: true, g: true, b: true, a: true }
  }
  const set = new Set(layer.channels.map((c) => c.toUpperCase()))
  return {
    r: set.has('R') || set.has('X'),
    g: set.has('G') || set.has('Y'),
    b: set.has('B') || set.has('Z'),
    a: set.has('A')
  }
}

const ExrPreviewPage: React.FC<ExrPreviewPageProps> = ({ assetId }) => {
  const { t } = useTranslation('preview')
  const { assets, closeExrPreview } = useApp()
  const [asset, setAsset] = useState<AssetItem | null>(() => assets.find((a) => a.id === assetId) ?? null)
  const [loadingAsset, setLoadingAsset] = useState(!asset)
  const [metadata, setMetadata] = useState<ExrFileMetadata | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [selectedLayer, setSelectedLayer] = useState(EXR_DEFAULT_LAYER_NAME)
  const [channels, setChannels] = useState<ExrChannelToggle>(DEFAULT_CHANNELS)
  const [exposure, setExposure] = useState(EXR_PREVIEW_DEFAULT_EXPOSURE)
  const [channelControlAvailable, setChannelControlAvailable] = useState(true)
  const [activeDisplayMode, setActiveDisplayMode] = useState<ExrAovDisplayMode>('hdr')
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const renderGenRef = useRef(0)
  const lastRenderInputRef = useRef<{ layer: string; channels: string; exposure: number }>({
    layer: EXR_DEFAULT_LAYER_NAME,
    channels: channelsKey(DEFAULT_CHANNELS),
    exposure: EXR_PREVIEW_DEFAULT_EXPOSURE
  })

  const ext = useMemo(() => asset?.extension ?? '', [asset?.extension])
  const isExr = isExrExtension(ext)

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
    setMetadata(null)
    setMetaError(null)
    setPreviewUrl(null)
    setRenderError(null)
    setScale(1)
    setOffset({ x: 0, y: 0 })

    if (!asset || !isExr) return

    let cancelled = false
    void window.assetVaultAPI.exr.getMetadata(assetId).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setMetaError(res.error)
        return
      }
      setMetadata(res.metadata)
      setChannelControlAvailable(res.metadata.channelControlAvailable)
      const compositeOnly = res.metadata.perLayerPreviewAvailable === false
      const defaultName = compositeOnly
        ? EXR_DEFAULT_LAYER_NAME
        : (res.metadata.defaultLayerName ??
          res.metadata.layers.find((l) => l.previewable)?.name ??
          res.metadata.layers[0]?.name ??
          EXR_DEFAULT_LAYER_NAME)
      const initialLayer =
        res.metadata.layers.find((l) => l.name === defaultName) ?? res.metadata.layers[0]
      if (initialLayer) {
        setSelectedLayer(initialLayer.name)
        setChannels(defaultToggleForLayer(initialLayer))
        setActiveDisplayMode(initialLayer.displayMode ?? 'hdr')
      }
    })

    return () => {
      cancelled = true
    }
  }, [asset?.id, assetId, isExr])

  useEffect(() => {
    if (!asset || !isExr || !metadata) return

    const gen = ++renderGenRef.current
    setRendering(true)
    setRenderError(null)

    const chKey = channelsKey(channels)
    const prev = lastRenderInputRef.current
    const layerOrChannelChanged =
      prev.layer !== selectedLayer || prev.channels !== chKey
    const delay = layerOrChannelChanged ? LAYER_CHANNEL_DEBOUNCE_MS : EXPOSURE_DEBOUNCE_MS
    lastRenderInputRef.current = { layer: selectedLayer, channels: chKey, exposure }

    const timer = setTimeout(() => {
      void window.assetVaultAPI.exr
        .renderPreview({
          assetId,
          layerName: selectedLayer,
          channels,
          exposure
        })
        .then((res) => {
          if (renderGenRef.current !== gen) return
          if (!res.ok) {
            setRenderError(formatExrPreviewError(res.error, res.failureReason))
            setPreviewUrl(null)
            return
          }
          setPreviewUrl(res.previewUrl)
          setChannelControlAvailable(res.channelControlAvailable)
          if (res.displayMode) setActiveDisplayMode(res.displayMode)
        })
        .finally(() => {
          if (renderGenRef.current === gen) setRendering(false)
        })
    }, delay)

    return () => clearTimeout(timer)
  }, [asset?.id, assetId, channels, exposure, isExr, metadata, selectedLayer])

  const handleBack = useCallback(() => closeExrPreview(), [closeExrPreview])

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

  const selectedLayerInfo = metadata?.layers.find((l) => l.name === selectedLayer)

  const toggleChannel = useCallback((key: keyof ExrChannelToggle) => {
    setChannels((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const selectLayer = useCallback(
    (layer: ExrLayerInfo) => {
      if (metadata?.perLayerPreviewAvailable === false) return
      setSelectedLayer(layer.name)
      setChannels(defaultToggleForLayer(layer))
      setActiveDisplayMode(layer.displayMode ?? 'hdr')
      setRenderError(null)
    },
    [metadata?.perLayerPreviewAvailable]
  )

  if (loadingAsset) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-av-text-muted">
        {t('loadingAsset')}
      </div>
    )
  }

  if (!asset || asset.fileType !== 'image' || !isExr) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-av-text-secondary">
        <p>{t('notFoundExr')}</p>
        <button type="button" className="btn-secondary text-sm" onClick={handleBack}>
          {t('backToLibrary')}
        </button>
      </div>
    )
  }

  const exposureEnabled = exposureAppliesToDisplayMode(activeDisplayMode)
  const perLayerPreviewAvailable = metadata?.perLayerPreviewAvailable !== false

  const dimLabel =
    metadata?.width && metadata?.height
      ? `${metadata.width} × ${metadata.height}`
      : asset.width && asset.height
        ? `${asset.width} × ${asset.height}`
        : 'OpenEXR'

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
            EXR · {formatFileSize(asset.fileSize)} · {dimLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <label
            className={`flex items-center gap-2 text-[11px] text-av-text-muted ${!exposureEnabled ? 'opacity-40' : ''}`}
            title={exposureEnabled ? undefined : t('exr.exposureDisabledTitle')}
          >
            {t('exposure')}
            <input
              type="range"
              min={EXR_PREVIEW_MIN_EXPOSURE}
              max={EXR_PREVIEW_MAX_EXPOSURE}
              step={0.05}
              value={exposure}
              disabled={!exposureEnabled}
              onChange={(e) => setExposure(Number(e.target.value))}
              className="w-24"
            />
            <span className="tabular-nums w-8 text-right">{exposure.toFixed(1)}</span>
          </label>
          <span className="text-[11px] text-av-text-muted tabular-nums w-12 text-right">
            {Math.round(scale * 100)}%
          </span>
          <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={resetView}>
            {t('resetView')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 border-r border-av-border bg-av-bg-secondary flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-av-border">
            <h2 className="text-xs font-semibold text-av-text-muted uppercase tracking-wider">
              {t('exr.layersTitle', { count: metadata?.layers.length ?? 0 })}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {metaError ? (
              <p className={`px-3 py-2 text-[11px] ${DESTRUCTIVE_MESSAGE_CLASS}`}>{metaError}</p>
            ) : !metadata ? (
              <p className="px-3 py-2 text-[11px] text-av-text-muted">{t('exr.parsingLayers')}</p>
            ) : !perLayerPreviewAvailable ? (
              <p className="px-3 py-2 text-[11px] text-av-text-muted leading-relaxed">
                {t('exr.oversizedCompositeOnly')}
              </p>
            ) : (
              metadata.layers.map((layer, layerIndex) => {
                const active = layer.name === selectedLayer
                const layerKey = `${layerIndex}:${layer.name}`
                return (
                  <div key={layerKey} className="border-b border-av-border/50 last:border-0">
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        active
                          ? 'bg-av-accent-blue/15 text-av-text-primary'
                          : 'text-av-text-secondary hover:bg-av-bg-primary/60'
                      } ${!layer.previewable ? 'opacity-70' : ''}`}
                      onClick={() => selectLayer(layer)}
                    >
                      <span className="font-medium">{layer.name}</span>
                      {!layer.previewable ? (
                        <span className="ml-1 text-[10px] text-av-text-muted">{t('exr.notPreviewable')}</span>
                      ) : null}
                    </button>
                    {active ? (
                      <div className="px-3 pb-2 flex flex-wrap gap-1 items-center">
                        {(() => {
                          const { toggleable, custom } = partitionExrLayerChannelSuffixes(
                            selectedLayerInfo?.channels ?? []
                          )
                          const disabled = !layer.previewable || !channelControlAvailable
                          return (
                            <>
                              {toggleable.map(({ suffix, key }) => {
                                const on = channels[key]
                                return (
                                  <button
                                    key={suffix}
                                    type="button"
                                    disabled={disabled}
                                    title={
                                      disabled
                                        ? layer.previewable
                                          ? t('exr.channelDisabledLarge')
                                          : t('exr.layerNotPreviewable')
                                        : undefined
                                    }
                                    className={`min-w-[1.75rem] px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                      on
                                        ? 'bg-av-accent-blue text-white border-av-accent-blue'
                                        : 'bg-av-bg-tertiary text-av-text-secondary border-av-border'
                                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                                    onClick={() => toggleChannel(key)}
                                  >
                                    {channelLabel(suffix)}
                                  </button>
                                )
                              })}
                              {custom.map((suffix) => (
                                <span
                                  key={suffix}
                                  className="min-w-[1.75rem] px-1.5 py-0.5 rounded text-[10px] font-semibold border border-av-border bg-av-bg-tertiary text-av-text-secondary"
                                  title={t('exr.customChannelTitle')}
                                >
                                  {channelLabel(suffix)}
                                </span>
                              ))}
                              {toggleable.length === 0 && custom.length > 0 ? (
                                <span className="text-[10px] text-av-text-muted">{t('exr.allChannels')}</span>
                              ) : null}
                            </>
                          )
                        })()}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
          {!channelControlAvailable && metadata && perLayerPreviewAvailable ? (
            <p className="px-3 py-2 text-[10px] text-av-text-muted border-t border-av-border leading-relaxed">
              {t('exr.oversizedChannelsDisabled')}
            </p>
          ) : null}
          {metadata?.layerListIncomplete ? (
            <p className="px-3 py-2 text-[10px] text-av-status-warning-muted-text border-t border-av-border leading-relaxed">
              {t('exr.layerListIncomplete')}
            </p>
          ) : null}
        </aside>

        <div
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
          {renderError && !previewUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-av-text-muted px-6 text-center">
              <p>{renderError}</p>
            </div>
          ) : previewUrl ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: 'center center'
              }}
            >
              <img
                src={previewUrl}
                alt={asset.filename}
                className="max-w-[min(92vw,1600px)] max-h-[min(85vh,1000px)] w-auto h-auto object-contain select-none pointer-events-none shadow-2xl"
                draggable={false}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-av-text-muted">
              {rendering ? t('exr.renderingHdr') : t('exr.preparingPreview')}
            </div>
          )}
          {rendering && previewUrl ? (
            <div className="absolute top-3 right-3 text-[10px] px-2 py-1 rounded bg-av-media-overlay-badge-bg text-av-media-overlay-badge-text">
              {t('exr.updating')}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ExrPreviewPage
