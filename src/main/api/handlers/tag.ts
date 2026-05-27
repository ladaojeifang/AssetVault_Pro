import {
  assignTagsToAssets,
  createTag,
  deleteTag,
  getTagById,
  listTags,
  removeTagsFromAssets,
  updateTag
} from '../../services/tagService'
import { jsendSuccess, serializeTag } from '../serialize'
import { invalidRequest, tagNotFound } from '../errors'
import {
  assertLibraryReady,
  optionalString,
  requireString,
  requireStringArray
} from './common'

export async function handleTagGet() {
  assertLibraryReady()
  const items = await listTags()
  return jsendSuccess({ data: items.map(serializeTag) })
}

export async function handleTagInfo(id: string | undefined) {
  assertLibraryReady()
  if (!id) throw invalidRequest('缺少参数 id')
  const tag = await getTagById(id)
  if (!tag) throw tagNotFound(id)
  return jsendSuccess(serializeTag(tag))
}

export async function handleTagCreate(body: Record<string, unknown>) {
  assertLibraryReady()
  const name = requireString(body.name, 'name')
  const color = optionalString(body.color)
  const description =
    body.description === null
      ? null
      : body.description !== undefined
        ? optionalString(body.description)
        : undefined
  const created = await createTag({ name, color, description })
  return jsendSuccess(serializeTag(created))
}

export async function handleTagUpdate(body: Record<string, unknown>) {
  assertLibraryReady()
  const id = requireString(body.id, 'id')
  const existing = await getTagById(id)
  if (!existing) throw tagNotFound(id)
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = requireString(body.name, 'name')
  if (body.color !== undefined) patch.color = optionalString(body.color) ?? existing.color
  if (body.description !== undefined) {
    patch.description = body.description === null ? null : optionalString(body.description)
  }
  await updateTag(id, patch)
  const updated = await getTagById(id)
  return jsendSuccess(updated ? serializeTag(updated) : { id, updated: true })
}

export async function handleTagDelete(body: Record<string, unknown>) {
  assertLibraryReady()
  const id = requireString(body.id, 'id')
  if (!(await getTagById(id))) throw tagNotFound(id)
  await deleteTag(id)
  return jsendSuccess({ deleted: true })
}

export async function handleTagAssign(body: Record<string, unknown>) {
  assertLibraryReady()
  const assetIds = requireStringArray(body.assetIds, 'assetIds')
  const tagIds = requireStringArray(body.tagIds, 'tagIds')
  await assignTagsToAssets(assetIds, tagIds)
  return jsendSuccess({ assigned: true })
}

export async function handleTagRemove(body: Record<string, unknown>) {
  assertLibraryReady()
  const assetIds = requireStringArray(body.assetIds, 'assetIds')
  const tagIds = requireStringArray(body.tagIds, 'tagIds')
  await removeTagsFromAssets(assetIds, tagIds)
  return jsendSuccess({ removed: true })
}
