/**
 * Unified asset types: system format types + user categories share one id space in the UI/API.
 * System type ids use prefix `__sys:` + file_type (e.g. `__sys:image`).
 */

import type { CategoryItem, FileType } from './types'

export const SYSTEM_TYPE_ID_PREFIX = '__sys:'

export const SYSTEM_TYPE_ENTRIES = [
  { fileType: 'image' as const, color: '#3b82f6', icon: '🖼️', sortOrder: 1000 },
  { fileType: 'video' as const, color: '#8b5cf6', icon: '🎬', sortOrder: 1001 },
  { fileType: 'audio' as const, color: '#ec4899', icon: '🎵', sortOrder: 1002 },
  { fileType: 'font' as const, color: '#14b8a6', icon: '🔤', sortOrder: 1003 },
  { fileType: 'design' as const, color: '#f59e0b', icon: '🎨', sortOrder: 1004 },
  { fileType: 'document' as const, color: '#64748b', icon: '📄', sortOrder: 1005 },
  { fileType: '3d' as const, color: '#06b6d4', icon: '📦', sortOrder: 1006 },
  { fileType: 'code' as const, color: '#22c55e', icon: '💻', sortOrder: 1007 },
  { fileType: 'other' as const, color: '#94a3b8', icon: '📎', sortOrder: 1008 }
] as const

const FILE_TYPES = new Set<FileType>(SYSTEM_TYPE_ENTRIES.map((e) => e.fileType))

export function systemTypeCategoryId(fileType: FileType): string {
  return `${SYSTEM_TYPE_ID_PREFIX}${fileType}`
}

export function isSystemTypeCategoryId(id: string): boolean {
  return id.startsWith(SYSTEM_TYPE_ID_PREFIX)
}

export function fileTypeFromSystemTypeCategoryId(id: string): FileType | null {
  if (!isSystemTypeCategoryId(id)) return null
  const ft = id.slice(SYSTEM_TYPE_ID_PREFIX.length) as FileType
  return FILE_TYPES.has(ft) ? ft : null
}

export function isUserCategoryId(id: string): boolean {
  return !isSystemTypeCategoryId(id)
}

export function defaultTypeIdForFileType(fileType: FileType): string {
  return systemTypeCategoryId(fileType)
}

/** Map source library type_id when importing / copying (user ids via categoryMap). */
export function resolveImportedTypeId(
  sourceTypeId: string | null | undefined,
  sourceFileType: string,
  categoryMap: Map<string, string>
): string {
  const fallback = defaultTypeIdForFileType(
    (sourceFileType || 'other') as FileType
  )
  const raw = sourceTypeId?.trim()
  if (!raw) return fallback
  if (isSystemTypeCategoryId(raw)) {
    return fileTypeFromSystemTypeCategoryId(raw) ? raw : fallback
  }
  return categoryMap.get(raw) ?? fallback
}

export function splitTypeFilterIds(typeFilterIds: string[]): {
  systemFileTypes: FileType[]
  userCategoryIds: string[]
} {
  const systemFileTypes: FileType[] = []
  const userCategoryIds: string[] = []
  for (const id of typeFilterIds) {
    const ft = fileTypeFromSystemTypeCategoryId(id)
    if (ft) systemFileTypes.push(ft)
    else userCategoryIds.push(id)
  }
  return { systemFileTypes, userCategoryIds }
}

export function buildSystemCategoryItems(
  usageByFileType: ReadonlyMap<string, number>
): CategoryItem[] {
  return SYSTEM_TYPE_ENTRIES.map((def) => ({
    id: systemTypeCategoryId(def.fileType),
    name: def.fileType,
    kind: 'system' as const,
    fileType: def.fileType,
    color: def.color,
    icon: def.icon,
    description: null,
    usageCount: usageByFileType.get(def.fileType) ?? 0,
    sortOrder: def.sortOrder
  }))
}

export function userCategoryItemsOnly(items: CategoryItem[]): CategoryItem[] {
  return items.filter((c) => c.kind === 'user')
}
