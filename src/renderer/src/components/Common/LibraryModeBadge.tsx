import React from 'react'
import { useTranslation } from 'react-i18next'
import type { LibraryMode } from '@/shared/libraryTypes'

const MODE_CLASS: Record<LibraryMode, string> = {
  catalog: 'bg-amber-950/50 text-amber-300 border-amber-800/50',
  embedded: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
  archive: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
}

export function LibraryModeBadge({
  mode,
  compact = true
}: {
  mode: LibraryMode
  /** Short label (完整/索引/内嵌) for switcher; false uses longer title (完整库/…). */
  compact?: boolean
}): React.ReactElement {
  const { t } = useTranslation('library')
  const shortLabel =
    mode === 'catalog' ? t('catalog') : mode === 'embedded' ? t('embedded') : t('archive')
  const longLabel =
    mode === 'catalog' ? t('catalogIndex') : mode === 'embedded' ? t('embeddedLibrary') : t('archiveFull')

  return (
    <span
      className={`shrink-0 text-[9px] font-medium px-1 py-0.5 rounded border ${MODE_CLASS[mode]}`}
      title={longLabel}
    >
      {compact ? shortLabel : longLabel}
    </span>
  )
}
