import React from 'react'
import { useTranslation } from 'react-i18next'
import type { LibraryMode } from '@/shared/libraryTypes'
import { LIBRARY_MODE_BADGE_CLASS } from '../../theme/libraryModeClasses'

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
      className={`shrink-0 text-[9px] font-medium px-1 py-0.5 rounded border ${LIBRARY_MODE_BADGE_CLASS[mode]}`}
      title={longLabel}
    >
      {compact ? shortLabel : longLabel}
    </span>
  )
}
