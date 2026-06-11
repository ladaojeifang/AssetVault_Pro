import { canRunSqliteIntegrationTests } from '../../../helpers/sqliteAvailable'
import '../../../helpers/registerElectronMock'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { getDatabase } from '@main/db'
import { assets } from '@main/db/schema'
import { importAssetFromPath } from '@main/services/assetImportService'
import { importSingleAsset } from '@main/services/importSingleAsset'
import { itemPackFileRelative, resolveLibraryPath } from '@main/services/libraryBundle'
import { writeSamplePng } from '../../../helpers/sampleAssets'
import { withTempLibrary } from '../../../helpers/withTempLibrary'

describe.skipIf(!canRunSqliteIntegrationTests())('importSingleAsset integration', () => {
  it('IMP-01: archive mode copies jpg into items/{id}/ and indexes image row', async () => {
    await withTempLibrary('archive', async ({ libraryRoot }) => {
      const source = join(libraryRoot, 'outside-sample.png')
      writeSamplePng(source)

      const assetId = await importSingleAsset(source, { duplicatePolicy: 'use_existing' })
      expect(assetId).toBeTruthy()

      const row = await getDatabase().select().from(assets).where(eq(assets.id, assetId!)).get()
      expect(row?.fileType).toBe('image')
      expect(row?.storageMode).toBe('local')
      expect(row?.extension).toBe('png')

      const packRel = itemPackFileRelative(assetId!, 'outside-sample.png')
      expect(row?.filePath).toBe(packRel)
      const packAbs = resolveLibraryPath(packRel)
      expect(existsSync(packAbs)).toBe(true)
    })
  })

  it('IMP-02: catalog mode references external png without copying into items/', async () => {
    await withTempLibrary('catalog', async ({ libraryRoot }) => {
      const source = join(libraryRoot, 'catalog-source.png')
      writeSamplePng(source)

      const assetId = await importSingleAsset(source, { duplicatePolicy: 'use_existing' })
      expect(assetId).toBeTruthy()

      const row = await getDatabase().select().from(assets).where(eq(assets.id, assetId!)).get()
      expect(row?.storageMode).toBe('referenced')
      expect(row?.filePath).toBe(source)
      expect(existsSync(source)).toBe(true)
      expect(existsSync(join(libraryRoot, 'items', assetId!, 'catalog-source.png'))).toBe(false)
    })
  })

  it('IMP-04: duplicate source path is skipped on second import', async () => {
    await withTempLibrary('archive', async ({ libraryRoot }) => {
      const source = join(libraryRoot, 'dup.png')
      writeSamplePng(source)

      const first = await importAssetFromPath(source, { duplicatePolicy: 'use_existing' })
      expect(first.skipped).toBe(false)
      expect(first.assetId).toBeTruthy()

      const second = await importAssetFromPath(source, { duplicatePolicy: 'use_existing' })
      expect(second.skipped).toBe(true)
      expect(second.reason).toBe('duplicate_source')
      expect(second.existingAssetId).toBe(first.assetId)
    })
  })
})
