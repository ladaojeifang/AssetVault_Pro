import {
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  resetAssetsTypeToDetected,
  setAssetsType,
  updateCategory
} from '../../services/categoryService'
import { isSystemTypeCategoryId } from '@/shared/assetTypeRegistry'
import { jsendSuccess, serializeCategory } from '../serialize'
import { categoryNotFound, invalidRequest, systemCategoryImmutable } from '../errors'
import {
  assertLibraryReady,
  optionalString,
  requireString,
  requireStringArray
} from './common'

export async function handleCategoryGet() {
  assertLibraryReady()
  const items = await listCategories()
  return jsendSuccess({ data: items.map(serializeCategory) })
}

export async function handleCategoryInfo(id: string | undefined) {
  assertLibraryReady()
  if (!id) throw invalidRequest('缺少参数 id')
  const category = await getCategoryById(id)
  if (!category) throw categoryNotFound(id)
  return jsendSuccess(serializeCategory(category))
}

export async function handleCategoryCreate(body: Record<string, unknown>) {
  assertLibraryReady()
  const name = requireString(body.name, 'name')
  const color = optionalString(body.color)
  const icon =
    body.icon === null ? null : body.icon !== undefined ? optionalString(body.icon) : undefined
  const description =
    body.description === null
      ? null
      : body.description !== undefined
        ? optionalString(body.description)
        : undefined
  const created = await createCategory({ name, color, icon, description })
  return jsendSuccess(serializeCategory(created))
}

export async function handleCategoryUpdate(body: Record<string, unknown>) {
  assertLibraryReady()
  const id = requireString(body.id, 'id')
  if (isSystemTypeCategoryId(id)) throw systemCategoryImmutable(id)
  const existing = await getCategoryById(id)
  if (!existing || existing.kind !== 'user') throw categoryNotFound(id)

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = requireString(body.name, 'name')
  if (body.color !== undefined) patch.color = optionalString(body.color) ?? existing.color
  if (body.icon !== undefined) {
    patch.icon = body.icon === null ? null : optionalString(body.icon)
  }
  if (body.description !== undefined) {
    patch.description = body.description === null ? null : optionalString(body.description)
  }
  const ok = await updateCategory(id, patch)
  if (!ok) throw categoryNotFound(id)
  const updated = await getCategoryById(id)
  return jsendSuccess(updated ? serializeCategory(updated) : { id, updated: true })
}

export async function handleCategoryDelete(body: Record<string, unknown>) {
  assertLibraryReady()
  const id = requireString(body.id, 'id')
  if (isSystemTypeCategoryId(id)) throw systemCategoryImmutable(id)
  if (!(await getCategoryById(id))) throw categoryNotFound(id)
  const ok = await deleteCategory(id)
  if (!ok) throw categoryNotFound(id)
  return jsendSuccess({ deleted: true })
}

function parseAssignTypeId(body: Record<string, unknown>): string {
  const typeId = optionalString(body.typeId)
  if (typeId) return typeId
  const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds : []
  if (categoryIds.length === 1 && typeof categoryIds[0] === 'string') {
    return categoryIds[0]
  }
  throw invalidRequest('请提供 typeId，或 categoryIds 数组（仅一个元素）')
}

export async function handleCategoryAssign(body: Record<string, unknown>) {
  assertLibraryReady()
  const assetIds = requireStringArray(body.assetIds, 'assetIds')
  const typeId = parseAssignTypeId(body)
  await setAssetsType(assetIds, typeId)
  return jsendSuccess({ assigned: true, typeId })
}

export async function handleCategoryRemove(body: Record<string, unknown>) {
  assertLibraryReady()
  const assetIds = requireStringArray(body.assetIds, 'assetIds')
  await resetAssetsTypeToDetected(assetIds)
  return jsendSuccess({ removed: true })
}

/** @deprecated alias for assign */
export async function handleCategoryResetType(body: Record<string, unknown>) {
  return handleCategoryRemove(body)
}
