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
import { handleLibrarySwitch } from '@main/api/handlers/library'
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

  it('library/switch rejects missing directory', async () => {
    await withTempLibrary('archive', async () => {
      await expect(
        handleLibrarySwitch({ libraryRoot: 'Z:\\av-nonexistent-library-root-xyz' })
      ).rejects.toBeInstanceOf(ApiError)
    })
  })
})
