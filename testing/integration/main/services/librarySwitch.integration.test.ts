import { canRunSqliteIntegrationTests } from '../../../helpers/sqliteAvailable'
import { fileWatcherStop } from '../../../helpers/registerElectronMock'
import '../../../helpers/registerElectronMock'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDatabase } from '@main/db'
import { assets } from '@main/db/schema'
import { getLibraryRoot } from '@main/services/libraryBundle'
import { importSingleAsset } from '@main/services/importSingleAsset'
import { prepareNewLibrarySkeleton, switchActiveLibrary } from '@main/services/librarySwitch'
import { writeSamplePng } from '../../../helpers/sampleAssets'
import { createTempLibrary } from '../../../helpers/withTempLibrary'

describe.skipIf(!canRunSqliteIntegrationTests())('librarySwitch integration', () => {
  beforeEach(() => {
    fileWatcherStop.mockClear()
  })

  it('LIB-02: switch A → B isolates assets per library', async () => {
    const libA = await createTempLibrary('archive')
    const png = join(libA.libraryRoot, 'a.png')
    writeSamplePng(png)
    const assetId = await importSingleAsset(png, { duplicatePolicy: 'use_existing' })
    expect(assetId).toBeTruthy()

    const libBRoot = mkdtempSync(join(tmpdir(), 'av-test-lib-b-'))
    prepareNewLibrarySkeleton(libBRoot, 'archive')

    const switched = await switchActiveLibrary(libBRoot)
    expect(switched.ok).toBe(true)
    expect(getLibraryRoot()).toBe(libBRoot)
    expect(fileWatcherStop).toHaveBeenCalled()

    const rowsB = await getDatabase().select().from(assets).all()
    expect(rowsB).toHaveLength(0)

    const back = await switchActiveLibrary(libA.libraryRoot)
    expect(back.ok).toBe(true)
    const rowsA = await getDatabase().select({ id: assets.id }).from(assets).all()
    expect(rowsA.map((r) => r.id)).toContain(assetId)

    await libA.close()
    try {
      const { rmSync } = await import('node:fs')
      rmSync(libBRoot, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  it('LIB-02: invalid target path returns error without throwing', async () => {
    const libA = await createTempLibrary('archive')
    const result = await switchActiveLibrary(join(libA.libraryRoot, 'not-a-real-subfolder'))
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.length).toBeGreaterThan(0)
    await libA.close()
  })
})
