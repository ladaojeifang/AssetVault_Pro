import type { QueryParams } from '@/shared/types'
import type { ColorBucket } from '@/shared/colorBucket'
import type { DatePreset, SizePreset } from '@/shared/assetFilters'
import type { FileType } from '@/shared/types'
import { queryAssets, getAssetById, deleteAssets } from '../../services/assetQueryService'
import {
  importAssetFromPath,
  importAssetFiles,
  importAssetFolder
} from '../../services/assetImportService'
import {
  localizeAssets,
  patchAsset,
  relinkAssetSource,
  renameAsset
} from '../../services/assetMutationService'
import { jsendSuccess, serializeAsset } from '../serialize'
import {
  assetNotFound,
  fileNotDirectory,
  fileNotFile,
  fileNotFound,
  invalidRequest
} from '../errors'
import { assertLibraryReady, requireString, requireStringArray } from './common'

function parseIntParam(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const n = typeof value === 'number' ? value : parseInt(String(value), 10)
  return Number.isFinite(n) ? n : fallback
}

function parseTags(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return undefined
}

export function parseAssetQueryInput(input: Record<string, unknown>): QueryParams {
  const limit = Math.min(1000, Math.max(1, parseIntParam(input.limit, 50)))
  const offset = Math.max(0, parseIntParam(input.offset, 0))
  const page = parseIntParam(input.page, 0)
  const pageSize = parseIntParam(input.pageSize, 0)

  const params: QueryParams = {
    search: typeof input.search === 'string' ? input.search : undefined,
    folderId: typeof input.folderId === 'string' ? input.folderId : undefined,
    fileType: typeof input.fileType === 'string' ? (input.fileType as FileType) : undefined,
    tags: parseTags(input.tags ?? input.tagIds),
    colorBucket:
      typeof input.colorBucket === 'string' ? (input.colorBucket as ColorBucket) : undefined,
    sizePreset:
      typeof input.sizePreset === 'string' ? (input.sizePreset as SizePreset) : undefined,
    minFileSizeMb:
      input.minFileSizeMb !== undefined ? parseIntParam(input.minFileSizeMb, 0) : undefined,
    maxFileSizeMb:
      input.maxFileSizeMb !== undefined ? parseIntParam(input.maxFileSizeMb, 0) : undefined,
    datePreset:
      typeof input.datePreset === 'string' ? (input.datePreset as DatePreset) : undefined,
    sortBy:
      typeof input.sortBy === 'string'
        ? (input.sortBy as QueryParams['sortBy'])
        : undefined,
    sortOrder: input.sortOrder === 'asc' || input.sortOrder === 'desc' ? input.sortOrder : undefined
  }

  if (page > 0 && pageSize > 0) {
    params.page = page
    params.pageSize = Math.min(200, pageSize)
  } else {
    params.offset = offset
    params.pageSize = limit
  }

  return params
}

export async function handleAssetGet(input: Record<string, unknown>) {
  assertLibraryReady()
  const params = parseAssetQueryInput(input)
  const result = await queryAssets(params)
  const offset =
    typeof params.offset === 'number'
      ? params.offset
      : ((params.page ?? 1) - 1) * (result.pageSize ?? 50)

  return jsendSuccess({
    data: result.items.map(serializeAsset),
    total: result.total,
    offset,
    limit: result.pageSize
  })
}

export async function handleAssetInfo(id: string | undefined, incrementView = true) {
  assertLibraryReady()
  if (!id || typeof id !== 'string') {
    throw invalidRequest('缺少参数 id')
  }
  const item = await getAssetById(id, { incrementViewCount: incrementView })
  if (!item) throw assetNotFound(id)
  return jsendSuccess(serializeAsset(item))
}

export async function handleAssetImport(body: Record<string, unknown>) {
  assertLibraryReady()
  const filePath = body.filePath
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw invalidRequest('缺少 filePath')
  }
  const targetFolderId =
    typeof body.targetFolderId === 'string' ? body.targetFolderId : undefined
  const duplicatePolicy =
    body.duplicatePolicy === 'ask' ||
    body.duplicatePolicy === 'use_existing' ||
    body.duplicatePolicy === 'import_copy'
      ? body.duplicatePolicy
      : 'use_existing'

  try {
    const result = await importAssetFromPath(filePath, { targetFolderId, duplicatePolicy })
    return jsendSuccess(result)
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'FILE_NOT_FOUND') throw fileNotFound(filePath)
      if (e.message === 'FILE_NOT_FILE') throw fileNotFile(filePath)
    }
    throw e
  }
}

export async function handleAssetImportBatch(body: Record<string, unknown>) {
  assertLibraryReady()
  const filePaths = body.filePaths
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    throw invalidRequest('缺少 filePaths 数组')
  }
  const paths = filePaths.filter((p): p is string => typeof p === 'string')
  const targetFolderId =
    typeof body.targetFolderId === 'string' ? body.targetFolderId : undefined
  const duplicatePolicy =
    body.duplicatePolicy === 'ask' ||
    body.duplicatePolicy === 'use_existing' ||
    body.duplicatePolicy === 'import_copy'
      ? body.duplicatePolicy
      : 'use_existing'

  const result = await importAssetFiles(paths, { targetFolderId, duplicatePolicy })
  return jsendSuccess(result)
}

export async function handleAssetImportFolder(body: Record<string, unknown>) {
  assertLibraryReady()
  const folderPath = body.folderPath
  if (typeof folderPath !== 'string' || !folderPath.trim()) {
    throw invalidRequest('缺少 folderPath')
  }
  const targetFolderId =
    typeof body.targetFolderId === 'string' ? body.targetFolderId : undefined
  const duplicatePolicy =
    body.duplicatePolicy === 'ask' ||
    body.duplicatePolicy === 'use_existing' ||
    body.duplicatePolicy === 'import_copy'
      ? body.duplicatePolicy
      : 'use_existing'

  try {
    const result = await importAssetFolder(folderPath, { targetFolderId, duplicatePolicy })
    return jsendSuccess(result)
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'FILE_NOT_FOUND') throw fileNotFound(folderPath)
      if (e.message === 'FILE_NOT_DIRECTORY') throw fileNotDirectory(folderPath)
    }
    throw e
  }
}

export async function handleAssetDelete(body: Record<string, unknown>) {
  assertLibraryReady()
  const ids = body.ids
  if (!Array.isArray(ids) || ids.length === 0) {
    throw invalidRequest('缺少 ids 数组')
  }
  const idList = ids.filter((id): id is string => typeof id === 'string')
  const deleted = await deleteAssets(idList)
  return jsendSuccess({ deleted })
}

export async function handleAssetUpdate(body: Record<string, unknown>) {
  assertLibraryReady()
  const id = requireString(body.id, 'id')
  if (body.notes === undefined && body.metadata === undefined) {
    throw invalidRequest('至少提供 notes 或 metadata')
  }
  let metadata: Record<string, unknown> | undefined
  if (body.metadata !== undefined) {
    if (body.metadata === null || typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
      throw invalidRequest('metadata 须为对象')
    }
    metadata = body.metadata as Record<string, unknown>
  }
  const updated = await patchAsset(id, { notes: body.notes, metadata })
  if (!updated) throw assetNotFound(id)
  return jsendSuccess(serializeAsset(updated))
}

export async function handleAssetRename(body: Record<string, unknown>) {
  assertLibraryReady()
  const id = requireString(body.id, 'id')
  const newName = requireString(body.newName, 'newName')
  try {
    await renameAsset(id, newName)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('不存在')) throw assetNotFound(id)
    throw invalidRequest(msg)
  }
  const item = await getAssetById(id, { incrementViewCount: false })
  if (!item) throw assetNotFound(id)
  return jsendSuccess(serializeAsset(item))
}

export async function handleAssetRelink(body: Record<string, unknown>) {
  assertLibraryReady()
  const assetId =
    typeof body.assetId === 'string'
      ? body.assetId.trim()
      : typeof body.id === 'string'
        ? body.id.trim()
        : ''
  if (!assetId) throw invalidRequest('缺少 assetId')
  const newSourcePath = requireString(body.newSourcePath, 'newSourcePath')
  const result = await relinkAssetSource(assetId, newSourcePath)
  if (!result.ok) {
    throw invalidRequest(result.error ?? '重链失败')
  }
  const item = await getAssetById(assetId, { incrementViewCount: false })
  return jsendSuccess(item ? serializeAsset(item) : { relinked: true })
}

export async function handleAssetLocalize(body: Record<string, unknown>) {
  assertLibraryReady()
  const assetIds = requireStringArray(body.assetIds, 'assetIds')
  const result = await localizeAssets(assetIds, { preferHardlink: true })
  return jsendSuccess(result)
}
