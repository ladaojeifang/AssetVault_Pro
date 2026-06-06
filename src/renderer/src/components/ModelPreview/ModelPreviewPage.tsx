import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssetItem } from '@/shared/types'
import { formatFileSize } from '@/shared/types'
import { isModel3dPreviewExtension, type ModelAnimationClipInfo } from '@/shared/model3dFormats'
import { useApp } from '../../stores/AppContext'
import { ModelPreviewViewport, type ModelPreviewControls } from './ModelPreviewViewport'
import { ModelAnimationTimeline } from './ModelAnimationTimeline'

interface ModelPreviewPageProps {
  assetId: string
}

function ToggleBtn({
  active,
  onClick,
  children,
  title
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active
          ? 'bg-av-accent-blue/20 text-av-accent-blue border border-av-accent-blue/40'
          : 'bg-av-bg-elevated text-av-text-secondary border border-av-border hover:bg-av-bg-hover'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

const ModelPreviewPage: React.FC<ModelPreviewPageProps> = ({ assetId }) => {
  const { t } = useTranslation('preview')
  const { assets, closeModelPreview } = useApp()
  const [asset, setAsset] = useState<AssetItem | null>(() => assets.find((a) => a.id === assetId) ?? null)
  const [loadingAsset, setLoadingAsset] = useState(!asset)
  const [modelFileUrl, setModelFileUrl] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [uvDebug, setUvDebug] = useState(false)
  const controlsRef = useRef<ModelPreviewControls | null>(null)

  const [animClips, setAnimClips] = useState<ModelAnimationClipInfo[]>([])
  const [animClipIndex, setAnimClipIndex] = useState(0)
  const [animPlaying, setAnimPlaying] = useState(false)
  const [animLoop, setAnimLoop] = useState(true)
  const [animTime, setAnimTime] = useState(0)
  const [animDuration, setAnimDuration] = useState(0)
  const [animSeekTime, setAnimSeekTime] = useState<number | null>(null)

  const ext = useMemo(() => asset?.extension ?? '', [asset?.extension])
  const supported = isModel3dPreviewExtension(ext)
  const hasAnimation = animClips.length > 0

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
    setAnimClips([])
    setAnimClipIndex(0)
    setAnimPlaying(false)
    setAnimTime(0)
    setAnimDuration(0)
    setAnimSeekTime(null)
  }, [assetId, modelFileUrl])

  useEffect(() => {
    if (!asset || asset.fileType !== '3d') {
      setModelFileUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      const target = asset.resolvedFilePath ?? asset.filePath
      const href = await window.assetVaultAPI.fs.pathToFileUrl(target)
      if (!cancelled && href) setModelFileUrl(href)
    })()
    return () => {
      cancelled = true
    }
  }, [asset?.id, asset?.filePath, asset?.resolvedFilePath, asset?.fileType])

  const handleBack = useCallback(() => closeModelPreview(), [closeModelPreview])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleBack()
      }
      if (e.key === ' ' && hasAnimation && e.target === document.body) {
        e.preventDefault()
        setAnimPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleBack, hasAnimation])

  const handleReady = useCallback((controls: ModelPreviewControls) => {
    controlsRef.current = controls
  }, [])

  const handleAnimationClipsLoaded = useCallback((clips: ModelAnimationClipInfo[]) => {
    setAnimClips(clips)
    setAnimClipIndex(0)
    setAnimPlaying(false)
    setAnimTime(0)
    setAnimDuration(clips[0]?.durationSeconds ?? 0)
    setAnimSeekTime(0)
  }, [])

  const handleAnimationTick = useCallback((payload: { time: number; duration: number; playing: boolean }) => {
    setAnimTime(payload.time)
    setAnimDuration(payload.duration)
    setAnimPlaying((prev) => (prev === payload.playing ? prev : payload.playing))
  }, [])

  const handleClipIndexChange = useCallback((index: number) => {
    setAnimClipIndex(index)
    setAnimPlaying(false)
    setAnimTime(0)
    setAnimDuration(animClips[index]?.durationSeconds ?? 0)
    setAnimSeekTime(0)
  }, [animClips])

  const handleSeek = useCallback((seconds: number) => {
    setAnimPlaying(false)
    setAnimTime(seconds)
    setAnimSeekTime(seconds)
  }, [])

  const resetView = () => controlsRef.current?.resetCamera()

  if (loadingAsset) {
    return (
      <div className="flex flex-1 items-center justify-center text-av-text-secondary text-sm">
        {t('loadingModel')}
      </div>
    )
  }

  if (!asset || asset.fileType !== '3d') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-av-text-secondary">
        <p>{t('notFound3d')}</p>
        <button type="button" className="btn-secondary text-sm" onClick={handleBack}>
          {t('backToLibrary')}
        </button>
      </div>
    )
  }

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
            {ext.toUpperCase()} · {formatFileSize(asset.fileSize)}
            {hasAnimation ? ` · ${t('model3d.animCount', { count: animClips.length })}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ToggleBtn active={showGrid} onClick={() => setShowGrid((v) => !v)} title={t('model3d.toggleGridTitle')}>
            {t('gridPlane')}
          </ToggleBtn>
          <ToggleBtn active={wireframe} onClick={() => setWireframe((v) => !v)} title={t('model3d.toggleWireframeTitle')}>
            {t('wireframe')}
          </ToggleBtn>
          <ToggleBtn active={uvDebug} onClick={() => setUvDebug((v) => !v)} title={t('model3d.toggleUvTitle')}>
            {t('uvDebug')}
          </ToggleBtn>
          <button
            type="button"
            className="btn-secondary text-xs px-3 py-1.5"
            onClick={resetView}
            title={t('model3d.resetCameraTitle')}
          >
            {t('defaultView')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col">
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 relative flex flex-col min-h-0">
            {!supported ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-av-text-muted px-6 text-center">
                {t('model3d.formatUnsupportedHint')}
              </div>
            ) : modelFileUrl ? (
              <ModelPreviewViewport
                fileUrl={modelFileUrl}
                extension={ext}
                showGrid={showGrid}
                wireframe={wireframe}
                uvDebug={uvDebug}
                animationClipIndex={animClipIndex}
                animationPlaying={animPlaying}
                animationLoop={animLoop}
                animationSeekTime={animSeekTime}
                className="absolute inset-0"
                onReady={handleReady}
                onAnimationClipsLoaded={handleAnimationClipsLoaded}
                onAnimationTick={handleAnimationTick}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-av-text-muted">
                {t('model3d.resolvingPath')}
              </div>
            )}
          </div>

          <aside className="w-56 shrink-0 border-l border-av-border bg-av-bg-secondary p-4 space-y-4 overflow-y-auto">
            <div>
              <h3 className="text-xs font-semibold text-av-text-muted uppercase tracking-wider mb-2">
                {t('model3d.controlsSection')}
              </h3>
              <ul className="text-[11px] text-av-text-secondary space-y-1.5 leading-relaxed">
                <li>{t('model3d.controlsRotate')}</li>
                <li>{t('model3d.controlsZoom')}</li>
                <li>{t('model3d.controlsPan')}</li>
                <li>{t('model3d.controlsReset', { view: t('defaultView') })}</li>
                {hasAnimation ? <li>{t('model3d.controlsPlayPause')}</li> : null}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-av-text-muted uppercase tracking-wider mb-2">
                {t('model3d.displaySection')}
              </h3>
              <ul className="text-[11px] text-av-text-secondary space-y-1.5 leading-relaxed">
                <li>{t('model3d.displayGrid')}</li>
                <li>{t('model3d.displayWireframe')}</li>
                <li>{t('model3d.displayUv')}</li>
              </ul>
            </div>
            {hasAnimation ? (
              <div>
                <h3 className="text-xs font-semibold text-av-text-muted uppercase tracking-wider mb-2">
                  {t('model3d.animationSection')}
                </h3>
                <ul className="text-[11px] text-av-text-secondary space-y-1.5 leading-relaxed">
                  <li>{t('model3d.timelineScrub')}</li>
                  <li>{t('model3d.timelineMulti')}</li>
                </ul>
              </div>
            ) : supported ? (
              <div>
                <h3 className="text-xs font-semibold text-av-text-muted uppercase tracking-wider mb-2">
                  {t('model3d.animationSection')}
                </h3>
                <p className="text-[11px] text-av-text-muted leading-relaxed">{t('model3d.noAnimationTracks')}</p>
              </div>
            ) : null}
          </aside>
        </div>

        {hasAnimation ? (
          <ModelAnimationTimeline
            clips={animClips}
            clipIndex={animClipIndex}
            onClipIndexChange={handleClipIndexChange}
            time={animTime}
            duration={animDuration}
            playing={animPlaying}
            onPlayingChange={setAnimPlaying}
            loop={animLoop}
            onLoopChange={setAnimLoop}
            onSeek={handleSeek}
          />
        ) : null}
      </div>
    </div>
  )
}

export default ModelPreviewPage
