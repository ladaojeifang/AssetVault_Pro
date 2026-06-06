import React from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelAnimationClipInfo } from '@/shared/model3dFormats'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

export function ModelAnimationTimeline({
  clips,
  clipIndex,
  onClipIndexChange,
  time,
  duration,
  playing,
  onPlayingChange,
  loop,
  onLoopChange,
  onSeek
}: {
  clips: ModelAnimationClipInfo[]
  clipIndex: number
  onClipIndexChange: (index: number) => void
  time: number
  duration: number
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  loop: boolean
  onLoopChange: (loop: boolean) => void
  onSeek: (seconds: number) => void
}): React.ReactElement | null {
  const { t } = useTranslation('preview')
  if (clips.length === 0) return null

  const safeDuration = Math.max(duration, 0.001)
  const clip = clips[clipIndex]

  return (
    <div className="shrink-0 border-t border-av-border bg-av-bg-secondary px-4 py-2.5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn-secondary w-8 h-8 p-0 flex items-center justify-center shrink-0"
        title={playing ? t('model3d.pause') : t('model3d.play')}
        onClick={() => onPlayingChange(!playing)}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <span className="text-[11px] text-av-text-muted tabular-nums shrink-0 w-[88px]">
        {formatTime(time)} / {formatTime(safeDuration)}
      </span>

      <input
        type="range"
        min={0}
        max={safeDuration}
        step={0.016}
        value={Math.min(time, safeDuration)}
        className="flex-1 min-w-[120px] h-1 accent-av-accent-blue cursor-pointer"
        onChange={(e) => onSeek(Number(e.target.value))}
      />

      {clips.length > 1 ? (
        <select
          className="input-base text-xs py-1 max-w-[160px] shrink-0"
          value={clipIndex}
          onChange={(e) => onClipIndexChange(Number(e.target.value))}
        >
          {clips.map((c, i) => (
            <option key={`${c.name}-${i}`} value={i}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-av-text-secondary truncate max-w-[160px] shrink-0" title={clip?.name}>
          {clip?.name}
        </span>
      )}

      <label className="flex items-center gap-1.5 text-xs text-av-text-secondary shrink-0 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={loop}
          onChange={(e) => onLoopChange(e.target.checked)}
          className="rounded border-av-border"
        />
        {t('model3d.loop')}
      </label>
    </div>
  )
}
