import React, { useEffect, useState } from 'react'
import { useFormatIconForExtension } from '../../stores/FormatIconOverridesContext'
import type { FormatIconEntry } from '@/shared/formatIconOverrides'
import { getMimeForExtension } from '@/shared/assetFormatRegistry'
import { fileTypePlaceholderGradientStyle } from '../../theme/fileTypeVisualStyle'

function mimeForFormatIconPath(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  if (dot < 0) return 'image/png'
  return getMimeForExtension(filePath.slice(dot)) ?? 'image/png'
}

export type FileTypePlaceholderSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<FileTypePlaceholderSize, string> = {
  sm: 'text-3xl',
  md: 'text-4xl',
  lg: 'text-5xl'
}

export function FileTypePlaceholder({
  fileType,
  extension,
  color,
  size = 'md',
  override: overrideProp
}: {
  fileType: string
  extension?: string | null
  color?: string | null
  size?: FileTypePlaceholderSize
  /** When set (e.g. settings preview), skips context lookup */
  override?: FormatIconEntry
}) {
  const fromContext = useFormatIconForExtension(extension)
  const override = overrideProp ?? fromContext
  const svgPx = size === 'sm' ? 32 : size === 'lg' ? 48 : 32

  if (override?.kind === 'emoji') {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-1 bg-av-bg-tertiary"
        style={{ backgroundColor: color ? `${color}22` : undefined }}
      >
        <span className={SIZE_CLASS[size]} aria-hidden>
          {override.value}
        </span>
        {extension ? (
          <span className="text-[10px] uppercase tracking-wide text-av-text-muted font-medium">
            .{extension.replace(/^\./, '')}
          </span>
        ) : null}
      </div>
    )
  }

  if (override?.kind === 'image') {
    return (
      <FormatIconImage
        path={override.value}
        extension={extension}
        color={color}
        size={size}
      />
    )
  }

  const cfg = fileTypeIcon(fileType, svgPx)
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        ...fileTypePlaceholderGradientStyle(fileType),
        backgroundColor: color ? `${color}18` : undefined
      }}
    >
      <span className="text-av-text-muted">{cfg}</span>
    </div>
  )
}

function FormatIconImage({
  path,
  extension,
  color
}: {
  path: string
  extension?: string | null
  color?: string | null
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setSrc(null)
    setFailed(false)

    void (async () => {
      try {
        const bytes = await window.assetVaultAPI.fs.readFileBytes(path)
        if (cancelled || !bytes?.byteLength) return
        objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: mimeForFormatIconPath(path) })
        )
        if (!cancelled) setSrc(objectUrl)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 bg-av-bg-tertiary"
      style={{ backgroundColor: color ? `${color}18` : undefined }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="max-w-full max-h-[85%] object-contain"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-10 h-10 rounded bg-av-bg-elevated animate-pulse" />
      )}
      {extension ? (
        <span className="text-[10px] uppercase tracking-wide text-av-text-muted font-medium">
          .{extension.replace(/^\./, '')}
        </span>
      ) : null}
    </div>
  )
}

function fileTypeIcon(fileType: string, svgPx: number): JSX.Element {
  const icons: Record<string, (n: number) => JSX.Element> = {
    image: iconImage,
    video: iconVideo,
    audio: iconAudio,
    font: iconFont,
    document: iconDocument,
    design: iconDesign,
    '3d': icon3d,
    code: iconCode
  }
  const render = icons[fileType] ?? iconDocument
  return render(svgPx)
}

function iconImage(n: number) {
  return (
    <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
    </svg>
  )
}

function iconVideo(n: number) {
  return (
    <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  )
}

function iconAudio(n: number) {
  return (
    <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function iconFont(n: number) {
  return (
    <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  )
}

function iconDocument(n: number) {
  return (
    <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function iconDesign(n: number) {
  return (
    <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  )
}

function icon3d(n: number) {
  return (
    <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

function iconCode(n: number) {
  return (
    <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}
