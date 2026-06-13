import React, { useEffect, useState } from 'react'
import { FolderGlyph } from './FolderGlyph'

export function isFolderIconImagePath(icon: string | null | undefined): boolean {
  return Boolean(icon && icon.startsWith('folder-icons/'))
}

export function FolderIconDisplay({
  icon,
  size = 14,
  className = '',
  accentColor,
  fillContainer = false
}: {
  icon?: string | null
  size?: number
  className?: string
  /** Accent stripe on the default folder glyph; falls back to theme primary accent. */
  accentColor?: string
  /** Scale icon to fill the parent box (e.g. folder browse cards). */
  fillContainer?: boolean
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isFolderIconImagePath(icon)) {
      setDataUrl(null)
      return
    }
    let cancel = false
    void window.assetVaultAPI.folders
      .getIconDataUrl(icon!)
      .then((u) => {
        if (!cancel) setDataUrl(u)
      })
      .catch(() => {
        if (!cancel) setDataUrl(null)
      })
    return () => {
      cancel = true
    }
  }, [icon])

  if (isFolderIconImagePath(icon) && dataUrl) {
    return (
      <img
        src={dataUrl}
        alt=""
        className={`rounded object-contain shrink-0 ${fillContainer ? 'w-full h-full' : ''} ${className}`}
        style={fillContainer ? undefined : { width: size, height: size }}
      />
    )
  }
  if (isFolderIconImagePath(icon) && !dataUrl) {
    return (
      <span
        className={`text-av-text-muted inline-block shrink-0 animate-pulse ${fillContainer ? 'w-full h-full' : ''}`}
        style={
          fillContainer
            ? undefined
            : { width: size, height: size, fontSize: Math.max(10, size * 0.65) }
        }
      >
        …
      </span>
    )
  }

  const txt = icon?.trim()
  if (txt) {
    return (
      <span
        className={`leading-none inline-flex items-center justify-center shrink-0 ${fillContainer ? 'w-full h-full text-[85%]' : ''} ${className}`}
        style={fillContainer ? undefined : { fontSize: size, width: size, height: size }}
        aria-hidden
      >
        {txt}
      </span>
    )
  }

  return (
    <FolderGlyph
      size={size}
      accentColor={accentColor}
      className={className}
      fillContainer={fillContainer}
    />
  )
}
