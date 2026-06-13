import React from 'react'

/** Minimal rounded folder outline with a colored accent stripe (default folder glyph). */
export function FolderGlyph({
  size = 16,
  accentColor = 'var(--av-accent-blue)',
  className = '',
  fillContainer = false
}: {
  size?: number
  accentColor?: string
  className?: string
  fillContainer?: boolean
}) {
  return (
    <svg
      {...(fillContainer ? {} : { width: size, height: size })}
      viewBox="0 0 22 18"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      className={`${fillContainer ? 'w-full h-full' : 'shrink-0'} text-av-text-primary/90 ${className}`}
      aria-hidden
    >
      <path
        d="M3.5 6.5V5.85c0-.91.74-1.65 1.65-1.65h4.75c.36 0 .7.15.95.38l1.15 1.04h5.55c.91 0 1.65.74 1.65 1.65v6.93c0 .91-.74 1.65-1.65 1.65H5.15c-.91 0-1.65-.74-1.65-1.65V6.5H3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="var(--av-bg-elevated)"
      />
      <path
        d="M4.35 7.85h13.3"
        stroke={accentColor}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
