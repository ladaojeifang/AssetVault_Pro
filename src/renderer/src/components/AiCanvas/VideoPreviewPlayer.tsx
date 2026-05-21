import React, { useCallback, useEffect, useRef, useState } from 'react'

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface VideoPreviewPlayerProps {
  src: string
  className?: string
  onPointerDownCapture?: (e: React.PointerEvent) => void
}

const VideoPreviewPlayer: React.FC<VideoPreviewPlayerProps> = ({
  src,
  className = '',
  onPointerDownCapture
}) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [ready, setReady] = useState(false)

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const syncFromVideo = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setCurrent(v.currentTime)
    setDuration(v.duration || 0)
    setPlaying(!v.paused)
    setMuted(v.muted)
  }, [])

  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
    setReady(false)
  }, [src])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play().catch(() => {})
    else v.pause()
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const onSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v || !duration) return
    const t = (Number(e.target.value) / 100) * duration
    v.currentTime = t
    setCurrent(t)
  }, [duration])

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    void el.requestFullscreen?.()
  }, [])

  const progressPct = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div
      ref={wrapRef}
      className={`ai-video-preview ${className}`}
      onPointerDownCapture={onPointerDownCapture}
      onDoubleClick={stop}
    >
      <video
        ref={videoRef}
        key={src}
        className="ai-video-preview__video"
        src={src}
        playsInline
        preload="metadata"
        onLoadedMetadata={() => {
          setReady(true)
          syncFromVideo()
        }}
        onTimeUpdate={syncFromVideo}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onClick={(e) => {
          stop(e)
          togglePlay()
        }}
      />

      {!playing && ready && (
        <button
          type="button"
          className="ai-video-preview__center-play nodrag"
          aria-label="播放"
          onClick={(e) => {
            stop(e)
            togglePlay()
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      <div className="ai-video-preview__controls nodrag titlebar-no-drag" onPointerDown={stop}>
        <button
          type="button"
          className="ai-video-preview__btn"
          aria-label={playing ? '暂停' : '播放'}
          onClick={(e) => {
            stop(e)
            togglePlay()
          }}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <span className="ai-video-preview__time">
          {formatTime(current)}
          {duration > 0 ? ` / ${formatTime(duration)}` : ''}
        </span>

        <input
          type="range"
          className="ai-video-preview__seek nowheel"
          min={0}
          max={100}
          step={0.1}
          value={progressPct}
          disabled={!duration}
          aria-label="播放进度"
          onChange={onSeek}
          onPointerDown={stop}
        />

        <button
          type="button"
          className="ai-video-preview__btn"
          aria-label={muted ? '取消静音' : '静音'}
          onClick={(e) => {
            stop(e)
            toggleMute()
          }}
        >
          {muted ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="ai-video-preview__btn"
          aria-label="全屏"
          onClick={(e) => {
            stop(e)
            toggleFullscreen()
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default VideoPreviewPlayer
