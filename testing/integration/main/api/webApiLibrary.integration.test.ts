import { canRunSqliteIntegrationTests } from '../../../helpers/sqliteAvailable'
import '../../../helpers/registerElectronMock'
import { describe, expect, it } from 'vitest'
import { closeDatabase, isDatabaseReady } from '@main/db'
import { handleAppInfo } from '@main/api/handlers/app'
import { handleLibraryInfo, handleLibraryState } from '@main/api/handlers/library'
import { handleAssetImport } from '@main/api/handlers/asset'
import { writeSamplePng } from '../../../helpers/sampleAssets'
import { withTempLibrary } from '../../../helpers/withTempLibrary'
import { join } from 'node:path'

describe('Web API library handlers integration', () => {
  it('GET /app/info exposes session feature flags', () => {
    const res = handleAppInfo()
    expect(res.status).toBe('success')
    expect(res.data.features).toContain('fullPageSession')
    expect(res.data.features).toContain('articleBundleSession')
    expect(res.data.apiVersion).toBe('v1')
  })
})

describe.skipIf(!canRunSqliteIntegrationTests())('Web API library handlers (SQLite)', () => {
  it('library info + state reflect an open temp archive library', async () => {
    await withTempLibrary('archive', async ({ libraryRoot }) => {
      const info = await handleLibraryInfo()
      expect(info.status).toBe('success')
      expect(info.data.libraryRoot).toBe(libraryRoot)
      expect(info.data.libraryMode).toBe('archive')

      const state = handleLibraryState()
      expect(state.status).toBe('success')
      expect(state.data.activeLibraryRoot).toBe(libraryRoot)
    })
  })

  it('POST asset/import matches IMP-01 through API layer', async () => {
    await withTempLibrary('archive', async ({ libraryRoot }) => {
      const filePath = join(libraryRoot, 'api-import.png')
      writeSamplePng(filePath)

      const res = await handleAssetImport({ filePath, duplicatePolicy: 'use_existing' })
      expect(res.status).toBe('success')
      expect(res.data.skipped).toBe(false)
      expect(res.data.assetId).toBeTruthy()
    })
  })

  it('LIB-03: isDatabaseReady is false while DB is closed', async () => {
    await withTempLibrary('archive', async () => {
      expect(isDatabaseReady()).toBe(true)
      await closeDatabase()
      expect(isDatabaseReady()).toBe(false)
    })
  })
})
