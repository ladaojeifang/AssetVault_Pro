import { existsSync } from 'fs'
import {
  isPageVideoCookieOptionalPlatform,
  type PageVideoCreateBody
} from '@/shared/pageVideoImportTypes'
import {
  normalizePageVideoFormatPreset,
  resolvePageVideoFormat,
  type PageVideoFormatPreset
} from '@/shared/pageVideoFormatPolicy'

export type ParsedPageVideoCreate = PageVideoCreateBody & {
  /** Warnings to attach to the job (e.g. unsupported API options). */
  parseWarnings: string[]
}

export type PageVideoParseDefaults = {
  formatPreset?: PageVideoFormatPreset
  maxVideoHeight?: number
}

function parseCookiesFromBrowser(
  value: unknown
): PageVideoCreateBody['cookiesFromBrowser'] {
  if (
    value === 'edge' ||
    value === 'chrome' ||
    value === 'firefox' ||
    value === 'none'
  ) {
    return value
  }
  return 'none'
}

function parseDuplicatePolicy(
  value: unknown
): { policy: 'import_copy' | 'use_existing'; warnings: string[] } {
  if (value === 'use_existing') {
    return { policy: 'use_existing', warnings: [] }
  }
  if (value === 'replace') {
    return {
      policy: 'import_copy',
      warnings: ['REPLACE_NOT_IMPLEMENTED']
    }
  }
  return { policy: 'import_copy', warnings: [] }
}

/**
 * Merge batch-level defaults with per-item overrides for `parseCreateBody`.
 * Omitted fields fall through to platform-specific format resolution.
 */
export function buildBatchItemBody(
  batch: Record<string, unknown>,
  item: Record<string, unknown>,
  sharedTarget: string | null | undefined
): Record<string, unknown> {
  const pick = (key: string): unknown => {
    const fromItem = item[key]
    if (fromItem !== undefined && fromItem !== null && fromItem !== '') return fromItem
    return batch[key]
  }

  const body: Record<string, unknown> = {
    url: item.url,
    platform: pick('platform'),
    targetFolderId: sharedTarget,
    duplicatePolicy: pick('duplicatePolicy'),
    cookiesFromBrowser: pick('cookiesFromBrowser'),
    cookiesFile: pick('cookiesFile'),
    cookieHeader: pick('cookieHeader'),
    sourceMeta: item.sourceMeta ?? batch.sourceMeta,
    options: item.options ?? batch.options
  }

  const format = pick('format')
  if (typeof format === 'string' && format.trim()) {
    body.format = format.trim()
  }

  const formatPreset = pick('formatPreset')
  if (typeof formatPreset === 'string' && formatPreset.trim()) {
    body.formatPreset = formatPreset.trim()
  }

  return body
}

export function parseCreateBody(
  body: Record<string, unknown>,
  defaults?: PageVideoParseDefaults
): ParsedPageVideoCreate {
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!url) throw new Error('INVALID_REQUEST')

  const { policy: duplicatePolicy, warnings: dupWarnings } = parseDuplicatePolicy(
    body.duplicatePolicy
  )
  let cookiesFromBrowser = parseCookiesFromBrowser(body.cookiesFromBrowser)
  const platform = typeof body.platform === 'string' ? body.platform.trim() : undefined
  const formatPreset =
    normalizePageVideoFormatPreset(body.formatPreset) ?? defaults?.formatPreset
  const format = resolvePageVideoFormat(
    platform,
    typeof body.format === 'string' ? body.format : undefined,
    {
      formatPreset,
      maxVideoHeight: defaults?.maxVideoHeight
    }
  )

  let targetFolderId: string | null | undefined = undefined
  if (body.targetFolderId === null) targetFolderId = null
  else if (typeof body.targetFolderId === 'string' && body.targetFolderId) {
    targetFolderId = body.targetFolderId
  }

  const sourceMeta =
    body.sourceMeta && typeof body.sourceMeta === 'object'
      ? (body.sourceMeta as PageVideoCreateBody['sourceMeta'])
      : undefined
  const options =
    body.options && typeof body.options === 'object'
      ? (body.options as PageVideoCreateBody['options'])
      : undefined

  let cookiesFile =
    typeof body.cookiesFile === 'string' && body.cookiesFile.trim()
      ? body.cookiesFile.trim()
      : undefined
  let cookieHeader =
    typeof body.cookieHeader === 'string' && body.cookieHeader.trim()
      ? body.cookieHeader.trim()
      : undefined

  if (isPageVideoCookieOptionalPlatform(platform)) {
    cookiesFile = undefined
    cookieHeader = undefined
    cookiesFromBrowser = 'none'
  }

  if (cookiesFile && cookieHeader) throw new Error('INVALID_REQUEST')
  if (cookiesFile && !existsSync(cookiesFile)) throw new Error('COOKIES_FILE_NOT_FOUND')

  return {
    url,
    platform,
    targetFolderId,
    duplicatePolicy,
    format,
    formatPreset,
    cookiesFromBrowser: cookiesFile || cookieHeader ? 'none' : cookiesFromBrowser,
    cookiesFile,
    cookieHeader,
    sourceMeta,
    options,
    parseWarnings: dupWarnings
  }
}
