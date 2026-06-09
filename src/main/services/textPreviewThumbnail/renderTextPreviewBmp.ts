import { openSync, readSync, closeSync, fstatSync } from 'fs'

import { decodeTextFileBytes } from './decodeTextFileBytes'

import {
  THUMBNAIL_DEFAULT_MAX_EDGE,
  THUMBNAIL_PIPELINE
} from '@/shared/thumbnailPipelineConfig'

export const TEXT_PREVIEW_DEFAULTS = {
  width: THUMBNAIL_DEFAULT_MAX_EDGE,
  height: THUMBNAIL_DEFAULT_MAX_EDGE,
  maxBytes: THUMBNAIL_PIPELINE.textPreview.maxBytes,
  maxLines: THUMBNAIL_PIPELINE.textPreview.maxLines
}

/** Sync partial read — avoids loading entire file when only head bytes are needed. */
export function readTextHead(filePath: string, maxBytes = TEXT_PREVIEW_DEFAULTS.maxBytes): string {
  const fd = openSync(filePath, 'r')
  try {
    const size = Math.min(maxBytes, fstatSync(fd).size)
    const buf = Buffer.alloc(size)
    readSync(fd, buf, 0, size, 0)
    return decodeTextFileBytes(buf)
  } finally {
    closeSync(fd)
  }
}
