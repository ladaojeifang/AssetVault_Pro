import {
  createFolder,
  deleteFolder,
  getFolderById,
  getFolderTree,
  listFolders,
  moveFolder,
  updateFolder
} from '../../services/folderService'
import { jsendSuccess, serializeFolder } from '../serialize'
import { folderNotFound, invalidRequest } from '../errors'
import {
  assertLibraryReady,
  optionalNullableString,
  optionalString,
  requireString
} from './common'

export async function handleFolderGet() {
  assertLibraryReady()
  const items = await listFolders()
  return jsendSuccess({ data: items.map(serializeFolder) })
}

export async function handleFolderTree() {
  assertLibraryReady()
  const tree = await getFolderTree()
  return jsendSuccess({ data: tree.map(serializeFolder) })
}

export async function handleFolderInfo(id: string | undefined) {
  assertLibraryReady()
  if (!id) throw invalidRequest('缺少参数 id')
  const folder = await getFolderById(id)
  if (!folder) throw folderNotFound(id)
  return jsendSuccess(serializeFolder(folder))
}

export async function handleFolderCreate(body: Record<string, unknown>) {
  assertLibraryReady()
  const name = requireString(body.name, 'name')
  const parentId = body.parentId === null ? null : optionalString(body.parentId)
  const color = optionalString(body.color)
  const icon = optionalNullableString(body.icon)
  try {
    const created = await createFolder({ name, parentId, color, icon })
    return jsendSuccess(serializeFolder(created))
  } catch (e) {
    throw invalidRequest(e instanceof Error ? e.message : String(e))
  }
}

export async function handleFolderUpdate(body: Record<string, unknown>) {
  assertLibraryReady()
  const id = requireString(body.id, 'id')
  const existing = await getFolderById(id)
  if (!existing) throw folderNotFound(id)
  const name = optionalString(body.name)
  const color = optionalString(body.color)
  const icon = body.icon === undefined ? undefined : optionalNullableString(body.icon)
  try {
    await updateFolder(id, { name, color, icon })
    const updated = await getFolderById(id)
    return jsendSuccess(updated ? serializeFolder(updated) : { id, updated: true })
  } catch (e) {
    throw invalidRequest(e instanceof Error ? e.message : String(e))
  }
}

export async function handleFolderDelete(body: Record<string, unknown>) {
  assertLibraryReady()
  const id = requireString(body.id, 'id')
  const existing = await getFolderById(id)
  if (!existing) throw folderNotFound(id)
  await deleteFolder(id)
  return jsendSuccess({ deleted: true })
}

export async function handleFolderMove(body: Record<string, unknown>) {
  assertLibraryReady()
  const id = requireString(body.id, 'id')
  const newParentId =
    body.newParentId === null || body.newParentId === ''
      ? null
      : requireString(body.newParentId, 'newParentId')
  const existing = await getFolderById(id)
  if (!existing) throw folderNotFound(id)
  try {
    await moveFolder(id, newParentId)
    return jsendSuccess({ moved: true })
  } catch (e) {
    throw invalidRequest(e instanceof Error ? e.message : String(e))
  }
}
