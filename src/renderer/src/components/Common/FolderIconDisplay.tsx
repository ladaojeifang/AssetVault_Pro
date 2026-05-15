import React, { useEffect, useState } from 'react'

export function isFolderIconImagePath(icon: string | null | undefined): boolean {
  return Boolean(icon && icon.startsWith('folder-icons/'))
}

export function FolderIconDisplay({
  icon,
  fallbackEmoji = '📂',
  size = 14,
  className = ''
}: {
  icon?: string | null
  fallbackEmoji?: string
  size?: number
  className?: string
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
        className={`rounded object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  if (isFolderIconImagePath(icon) && !dataUrl) {
    return (
      <span
        className="text-av-text-muted inline-block shrink-0 animate-pulse"
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.65) }}
      >
        …
      </span>
    )
  }
  const txt = icon?.trim() || fallbackEmoji
  return (
    <span
      className={`leading-none inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ fontSize: size, width: size, height: size }}
      aria-hidden
    >
      {txt}
    </span>
  )
}
