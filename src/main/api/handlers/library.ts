import { getLibraryInfo, getLibraryState } from '../../services/libraryApiService'
import { importLibraryFromPath } from '../../services/importLibraryFromPath'
import { switchActiveLibrary } from '../../services/librarySwitch'
import { jsendSuccess } from '../serialize'
import { ApiError } from '../errors'
import { assertLibraryReady, requireString } from './common'
import type { ImportLibraryFailure } from '@/shared/libraryTypes'

const IMPORT_ERROR_HTTP: Record<NonNullable<ImportLibraryFailure['code']>, number> = {
  INVALID_PATH: 400,
  INVALID_SOURCE_MODE: 400,
  SAME_LIBRARY: 400,
  SOURCE_NOT_FOUND: 404,
  SOURCE_DB_ERROR: 503,
  TARGET_NOT_ARCHIVE: 409,
  TARGET_NOT_CATALOG: 409,
  LIBRARY_BUSY: 409
}

export async function handleLibraryInfo() {
  return jsendSuccess(await getLibraryInfo())
}

export function handleLibraryState() {
  return jsendSuccess(getLibraryState())
}

export async function handleLibrarySwitch(body: Record<string, unknown>) {
  const libraryRoot = requireString(body.libraryRoot, 'libraryRoot')
  const result = await switchActiveLibrary(libraryRoot)
  if (!result.ok) {
    throw new ApiError('LIBRARY_SWITCH_FAILED', result.error, 400)
  }
  return jsendSuccess(await getLibraryInfo())
}

export async function handleLibraryImportFromLibrary(body: Record<string, unknown>) {
  assertLibraryReady()
  const sourceLibraryRoot = requireString(body.sourceLibraryRoot, 'sourceLibraryRoot')
  const result = await importLibraryFromPath(sourceLibraryRoot)
  if (!result.ok) {
    const code = result.code ?? 'IMPORT_FAILED'
    const httpStatus = result.code ? IMPORT_ERROR_HTTP[result.code] : 400
    throw new ApiError(code, result.error, httpStatus)
  }
  return jsendSuccess(result)
}
