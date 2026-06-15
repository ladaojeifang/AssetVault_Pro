import { canRunSqliteIntegrationTests } from '../../../helpers/sqliteAvailable'
import '../../../helpers/registerElectronMock'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@main/api/errors'
import {
  handleAssetDelete,
  handleAssetGet,
  handleAssetImport,
  handleAssetInfo
} from '@main/api/handlers/asset'
import { handleCategoryAssign, handleCategoryGet } from '@main/api/handlers/category'
import { handleLibrarySwitch } from '@main/api/handlers/library'
import { systemTypeCategoryId } from '@/shared/assetTypeRegistry'
import {
  setAssetsType,
  createCategory
} from '@main/services/categoryService'
import { writeTempSamplePng } from '../../../helpers/sampleAssets'
import { withTempLibrary } from '../../../helpers/withTempLibrary'

describe.skipIf(!canRunSqliteIntegrationTests())('Web API asset handlers integration', () => {
  it('asset/import → info → get → delete lifecycle', async () => {
    await withTempLibrary('archive', async () => {
      const filePath = writeTempSamplePng('lifecycle.png')

      const imported = await handleAssetImport({ filePath, duplicatePolicy: 'use_existing' })
      expect(imported.status).toBe('success')
      expect(imported.data.skipped).toBe(false)
      const assetId = imported.data.assetId!
      expect(assetId).toBeTruthy()

      const info = await handleAssetInfo(assetId, false)
      expect(info.status).toBe('success')
      expect(info.data.id).toBe(assetId)
      expect(info.data.fileType).toBe('image')

      const listed = await handleAssetGet({ limit: 50, offset: 0 })
      expect(listed.status).toBe('success')
      expect(listed.data.total).toBeGreaterThanOrEqual(1)
      expect(listed.data.data.some((a) => a.id === assetId)).toBe(true)

      const deleted = await handleAssetDelete({ ids: [assetId] })
      expect(deleted.status).toBe('success')
      expect(deleted.data.deleted).toBeGreaterThanOrEqual(1)

      await expect(handleAssetInfo(assetId, false)).rejects.toBeInstanceOf(ApiError)
    })
  })

  it('asset/get filters by typeFilters (system OR user category)', async () => {
    await withTempLibrary('archive', async () => {
      const filePath = writeTempSamplePng('type-filter.png')
      const imported = await handleAssetImport({ filePath, duplicatePolicy: 'use_existing' })
      const assetId = imported.data.assetId!

      const category = await createCategory({ name: 'Refs', color: '#ff0000' })
      await setAssetsType([assetId], category.id)

      const bySystem = await handleAssetGet({
        typeFilters: systemTypeCategoryId('image'),
        limit: 50,
        offset: 0
      })
      expect(bySystem.data.data.some((a) => a.id === assetId)).toBe(false)

      const byUser = await handleAssetGet({
        typeFilters: category.id,
        limit: 50,
        offset: 0
      })
      expect(byUser.data.data.some((a) => a.id === assetId)).toBe(true)

      await setAssetsType([assetId], systemTypeCategoryId('image'))
      const bySystemAfterReset = await handleAssetGet({
        typeFilters: systemTypeCategoryId('image'),
        limit: 50,
        offset: 0
      })
      expect(bySystemAfterReset.data.data.some((a) => a.id === assetId)).toBe(true)

      const byOther = await handleAssetGet({
        typeFilters: systemTypeCategoryId('video'),
        limit: 50,
        offset: 0
      })
      expect(byOther.data.data.some((a) => a.id === assetId)).toBe(false)

      await handleAssetDelete({ ids: [assetId] })
    })
  })

  it('category/get lists system types and supports assign', async () => {
    await withTempLibrary('archive', async () => {
      const listed = await handleCategoryGet()
      expect(listed.status).toBe('success')
      const items = listed.data.data as Array<{ id: string; kind: string }>
      expect(items.some((c) => c.id === systemTypeCategoryId('image') && c.kind === 'system')).toBe(
        true
      )

      const filePath = writeTempSamplePng('cat-api.png')
      const imported = await handleAssetImport({ filePath, duplicatePolicy: 'use_existing' })
      const assetId = imported.data.assetId!
      const userCat = items.find((c) => c.kind === 'user')
      let categoryId = userCat?.id
      if (!categoryId) {
        const { createCategory } = await import('@main/services/categoryService')
        const created = await createCategory({ name: 'API Cat' })
        categoryId = created.id
      }

      await handleCategoryAssign({ assetIds: [assetId], typeId: categoryId })

      const info = await handleAssetInfo(assetId, false)
      expect(info.data.typeId).toBe(categoryId)
      expect(info.data.categoryIds).toEqual([categoryId])

      await handleAssetDelete({ ids: [assetId] })
    })
  })

  it('library/switch rejects missing directory', async () => {
    await withTempLibrary('archive', async () => {
      await expect(
        handleLibrarySwitch({ libraryRoot: 'Z:\\av-nonexistent-library-root-xyz' })
      ).rejects.toBeInstanceOf(ApiError)
    })
  })
})
