import { canRunSqliteIntegrationTests } from '../../../helpers/sqliteAvailable'
import '../../../helpers/registerElectronMock'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { getDatabase } from '@main/db'
import { assets } from '@main/db/schema'
import { importAssetFolder } from '@main/services/assetImportService'
import { writeSamplePng } from '../../../helpers/sampleAssets'
import { withTempLibrary } from '../../../helpers/withTempLibrary'

describe.skipIf(!canRunSqliteIntegrationTests())('assetImportFolder integration', () => {
  it('IMP-03: folder scan imports supported extensions only', async () => {
    await withTempLibrary('archive', async ({ libraryRoot }) => {
      const folder = join(libraryRoot, 'scan-in')
      mkdirSync(folder, { recursive: true })
      writeSamplePng(join(folder, 'keep.png'))
      writeFileSync(join(folder, 'skip.xyz'), 'not supported')
      writeFileSync(join(folder, 'readme.txt'), 'plain text is supported')

      const result = await importAssetFolder(folder, { duplicatePolicy: 'use_existing' })
      expect(result.totalFiles).toBe(2)
      expect(result.imported.length).toBe(2)
      expect(result.errors).toEqual([])

      const rows = await getDatabase().select({ ext: assets.extension }).from(assets).all()
      const exts = new Set(rows.map((r) => r.ext))
      expect(exts.has('png')).toBe(true)
      expect(exts.has('txt')).toBe(true)
      expect(exts.has('xyz')).toBe(false)
    })
  })
})
