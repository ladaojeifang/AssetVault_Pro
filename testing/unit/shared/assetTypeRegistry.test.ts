import { describe, expect, it } from 'vitest'
import {
  SYSTEM_TYPE_ID_PREFIX,
  SYSTEM_TYPE_ENTRIES,
  buildSystemCategoryItems,
  fileTypeFromSystemTypeCategoryId,
  isSystemTypeCategoryId,
  isUserCategoryId,
  splitTypeFilterIds,
  systemTypeCategoryId,
  userCategoryItemsOnly
} from '@/shared/assetTypeRegistry'
import type { CategoryItem } from '@/shared/types'

describe('assetTypeRegistry', () => {
  it('builds stable system type ids', () => {
    expect(systemTypeCategoryId('image')).toBe('__sys:image')
    expect(isSystemTypeCategoryId('__sys:video')).toBe(true)
    expect(isUserCategoryId('__sys:font')).toBe(false)
    expect(isUserCategoryId('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('parses file type from system id', () => {
    expect(fileTypeFromSystemTypeCategoryId('__sys:3d')).toBe('3d')
    expect(fileTypeFromSystemTypeCategoryId('__sys:unknown')).toBeNull()
    expect(fileTypeFromSystemTypeCategoryId('user-cat-id')).toBeNull()
  })

  it('splits mixed type filter ids', () => {
    const userId = 'cat-1'
    expect(
      splitTypeFilterIds([systemTypeCategoryId('image'), userId, systemTypeCategoryId('font')])
    ).toEqual({
      systemFileTypes: ['image', 'font'],
      userCategoryIds: [userId]
    })
  })

  it('builds system category items with usage counts', () => {
    const usage = new Map<string, number>([['image', 12], ['video', 3]])
    const items = buildSystemCategoryItems(usage)
    expect(items).toHaveLength(SYSTEM_TYPE_ENTRIES.length)
    const image = items.find((i) => i.fileType === 'image')
    expect(image).toMatchObject({
      id: `${SYSTEM_TYPE_ID_PREFIX}image`,
      kind: 'system',
      usageCount: 12
    })
    expect(items.find((i) => i.fileType === 'audio')?.usageCount).toBe(0)
  })

  it('filters user categories only', () => {
    const mixed: CategoryItem[] = [
      {
        id: systemTypeCategoryId('image'),
        name: 'image',
        color: '#000',
        usageCount: 1,
        sortOrder: 0,
        kind: 'system',
        fileType: 'image'
      },
      {
        id: 'user-1',
        name: 'Refs',
        color: '#f00',
        usageCount: 2,
        sortOrder: 0,
        kind: 'user'
      }
    ]
    expect(userCategoryItemsOnly(mixed).map((c) => c.id)).toEqual(['user-1'])
  })
})
