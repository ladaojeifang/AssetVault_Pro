import React from 'react'
import { useTranslation } from 'react-i18next'

const SLOT_COUNT = 10

export function parseAssetPaletteColors(
  colorsJson: string | null | undefined,
  dominantColor?: string | null
): string[] {
  let list: string[] = []
  if (colorsJson?.trim()) {
    try {
      const parsed = JSON.parse(colorsJson) as unknown
      if (Array.isArray(parsed)) {
        list = parsed
          .filter((c): c is string => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(c.trim()))
          .map((c) => c.toUpperCase())
      }
    } catch {
      /* ignore */
    }
  }
  if (list.length === 0 && dominantColor && /^#[0-9A-Fa-f]{6}$/i.test(dominantColor)) {
    list = [dominantColor.toUpperCase()]
  }
  while (list.length < SLOT_COUNT && list.length > 0) {
    list.push(list[list.length - 1])
  }
  return list.slice(0, SLOT_COUNT)
}

/** Reference-style pill: 10 circular swatches in a row */
export const ColorPaletteStrip: React.FC<{
  colors: string[]
  className?: string
}> = ({ colors, className = '' }) => {
  const { t } = useTranslation('assets')
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => colors[i] ?? null)

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-full border border-av-border/50 bg-av-bg-tertiary/90 shadow-inner ${className}`}
      role="img"
      aria-label={t('colorPaletteAria')}
    >
      {slots.map((hex, i) => (
        <span
          key={i}
          className="w-[22px] h-[22px] rounded-full shrink-0 ring-1 ring-black/25 shadow-sm"
          style={{ backgroundColor: hex ?? '#2a2a2a' }}
          title={hex ?? undefined}
        />
      ))}
    </div>
  )
}
