import '../../../helpers/registerElectronMock'
import { describe, expect, it } from 'vitest'
import { handleCategoryGet, handleCategoryInfo } from '@main/api/handlers/category'
import { systemTypeCategoryId } from '@/shared/assetTypeRegistry'

describe('category API handlers', () => {
  it('handleCategoryGet is exported', () => {
    expect(handleCategoryGet).toBeTypeOf('function')
    expect(handleCategoryInfo).toBeTypeOf('function')
    expect(systemTypeCategoryId('image')).toBe('__sys:image')
  })
})
