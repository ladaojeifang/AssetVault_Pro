import type { CSSProperties } from 'react'
import { resolveFileTypeVisualKey } from '@/shared/fileTypeVisualCatalog'

/** Inline gradient style for {@link FileTypePlaceholder} default icons. */
export function fileTypePlaceholderGradientStyle(fileType: string): CSSProperties {
  const key = resolveFileTypeVisualKey(fileType)
  return {
    backgroundImage: `linear-gradient(to bottom right, var(--av-filetype-${key}-from), var(--av-filetype-${key}-to))`
  }
}
