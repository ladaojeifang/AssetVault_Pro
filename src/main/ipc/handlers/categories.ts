import { ipcMain } from 'electron'
import { assertPlainObject, assertString, assertStringArray } from '../ipcGuards'
import {
  assignCategoriesToAssets,
  createCategory,
  deleteCategory,
  listCategories,
  removeCategoriesFromAssets,
  resetAssetsTypeToDetected,
  setAssetsType,
  updateCategory
} from '../../services/categoryService'

export function handleCategoryOperations(ipc: typeof ipcMain): void {
  ipc.handle('categories:list', async () => listCategories())

  ipc.handle(
    'categories:create',
    async (_event, data: { name: string; color?: string; icon?: string; description?: string }) => {
      assertPlainObject('data', data)
      assertString('data.name', (data as { name: string }).name)
      return createCategory(data)
    }
  )

  ipc.handle('categories:update', async (_event, id: string, data: Record<string, unknown>) => {
    assertString('id', id)
    assertPlainObject('data', data)
    return updateCategory(id, data)
  })

  ipc.handle('categories:delete', async (_event, id: string) => {
    assertString('id', id)
    return deleteCategory(id)
  })

  ipc.handle(
    'categories:set-assets-type',
    async (_event, assetIds: string[], typeId: string) => {
      assertStringArray('assetIds', assetIds)
      assertString('typeId', typeId)
      return setAssetsType(assetIds, typeId)
    }
  )

  ipc.handle(
    'categories:assign-to-assets',
    async (_event, assetIds: string[], categoryIds: string[]) => {
      assertStringArray('assetIds', assetIds)
      assertStringArray('categoryIds', categoryIds)
      return assignCategoriesToAssets(assetIds, categoryIds)
    }
  )

  ipc.handle('categories:reset-assets-type', async (_event, assetIds: string[]) => {
    assertStringArray('assetIds', assetIds)
    return resetAssetsTypeToDetected(assetIds)
  })

  ipc.handle(
    'categories:remove-from-assets',
    async (_event, assetIds: string[], categoryIds: string[]) => {
      assertStringArray('assetIds', assetIds)
      assertStringArray('categoryIds', categoryIds)
      return removeCategoriesFromAssets(assetIds, categoryIds)
    }
  )
}
