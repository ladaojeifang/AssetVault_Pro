import type { LibraryMode } from '@/shared/libraryTypes'

/** Library mode pill colors — backed by `--av-badge-*` CSS variables. */
export const LIBRARY_MODE_BADGE_CLASS: Record<LibraryMode, string> = {
  catalog: 'bg-av-badge-catalog-bg text-av-badge-catalog-text border-av-badge-catalog-border',
  embedded: 'bg-av-badge-embedded-bg text-av-badge-embedded-text border-av-badge-embedded-border',
  archive: 'bg-av-badge-archive-bg text-av-badge-archive-text border-av-badge-archive-border'
}
