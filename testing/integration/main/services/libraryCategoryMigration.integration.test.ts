import { canRunSqliteIntegrationTests } from '../../../helpers/sqliteAvailable'
import '../../../helpers/registerElectronMock'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { describe, expect, it } from 'vitest'
import { getDatabase } from '@main/db'
import { openBetterSqliteDatabase } from '@main/db/betterSqliteNative'
import { assets, categories } from '@main/db/schema'
import * as schema from '@main/db/schema'
import { setAssetsType, createCategory } from '@main/services/categoryService'
import { copyAssetsToOtherLibrary } from '@main/services/copyAssetsToOtherLibrary'
import { importLibraryFromPath } from '@main/services/importLibraryFromPath'
import { importSingleAsset } from '@main/services/importSingleAsset'
import { LIBRARY_DB_NAME } from '@main/services/libraryBundle'
import { prepareNewLibrarySkeleton, switchActiveLibrary } from '@main/services/librarySwitch'
import { writeSamplePng } from '../../../helpers/sampleAssets'
import { createTempLibrary, type TempLibraryContext } from '../../../helpers/withTempLibrary'

async function seedArchiveAssetWithCategory(ctx: TempLibraryContext) {
  const png = join(ctx.libraryRoot, 'category-migration.png')
  writeSamplePng(png)
  const assetId = await importSingleAsset(png, { duplicatePolicy: 'use_existing' })
  expect(assetId).toBeTruthy()

  const category = await createCategory({ name: 'Concept Art', color: '#FF9F1C' })
  await setAssetsType([assetId!], category.id)

  return { assetId: assetId!, categoryId: category.id, categoryName: category.name }
}

function readMetaJson(libraryRoot: string, assetId: string) {
  const metaPath = join(libraryRoot, 'items', assetId, 'meta.json')
  expect(existsSync(metaPath)).toBe(true)
  return JSON.parse(readFileSync(metaPath, 'utf-8')) as {
    typeId?: string
    type?: { id: string; name: string }
  }
}

describe.skipIf(!canRunSqliteIntegrationTests())('library category migration integration', () => {
  it('sidecar meta.json includes type after assign', async () => {
    const lib = await createTempLibrary('archive')
    try {
      const { assetId, categoryId, categoryName } = await seedArchiveAssetWithCategory(lib)
      const meta = readMetaJson(lib.libraryRoot, assetId)
      expect(meta.typeId).toBe(categoryId)
      expect(meta.type).toEqual({ id: categoryId, name: categoryName })
    } finally {
      await lib.close()
    }
  })

  it('copyAssetsToOtherLibrary copies user type and sidecar', async () => {
    const libA = await createTempLibrary('archive')
    const targetRoot = mkdtempSync(join(tmpdir(), 'av-test-lib-copy-target-'))
    prepareNewLibrarySkeleton(targetRoot, 'archive')

    try {
      const { assetId, categoryName } = await seedArchiveAssetWithCategory(libA)
      const { copied } = await copyAssetsToOtherLibrary([assetId], targetRoot)
      expect(copied).toBe(1)

      const raw = openBetterSqliteDatabase(join(targetRoot, LIBRARY_DB_NAME), { readonly: true })
      try {
        const targetDb = drizzle(raw, { schema })
        const cat = await targetDb
          .select()
          .from(categories)
          .where(eq(categories.name, categoryName))
          .get()
        expect(cat).toBeTruthy()

        const copiedAsset = await targetDb
          .select()
          .from(assets)
          .where(eq(assets.filename, 'category-migration.png'))
          .get()
        expect(copiedAsset).toBeTruthy()
        expect(copiedAsset!.typeId).toBe(cat!.id)

        const meta = readMetaJson(targetRoot, copiedAsset!.id)
        expect(meta.type).toEqual({ id: cat!.id, name: categoryName })
        expect(meta.typeId).toBe(cat!.id)
      } finally {
        raw.close()
      }
    } finally {
      await libA.close()
      try {
        rmSync(targetRoot, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  })

  it('importLibraryFromPath merges user types (archive→archive)', async () => {
    const libA = await createTempLibrary('archive')
    const targetRoot = mkdtempSync(join(tmpdir(), 'av-test-lib-import-target-'))
    prepareNewLibrarySkeleton(targetRoot, 'archive')

    try {
      const { categoryName } = await seedArchiveAssetWithCategory(libA)

      const switched = await switchActiveLibrary(targetRoot)
      expect(switched.ok).toBe(true)

      const result = await importLibraryFromPath(libA.libraryRoot)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.categoriesCreated).toBeGreaterThanOrEqual(1)
      expect(result.assetsAdded).toBeGreaterThanOrEqual(1)

      const cat = await getDatabase()
        .select()
        .from(categories)
        .where(eq(categories.name, categoryName))
        .get()
      expect(cat).toBeTruthy()

      const imported = await getDatabase()
        .select()
        .from(assets)
        .where(eq(assets.filename, 'category-migration.png'))
        .get()
      expect(imported).toBeTruthy()
      expect(imported!.typeId).toBe(cat!.id)

      const meta = readMetaJson(targetRoot, imported!.id)
      expect(meta.type).toEqual({ id: cat!.id, name: categoryName })
      expect(meta.typeId).toBe(cat!.id)
    } finally {
      await libA.close()
      try {
        rmSync(targetRoot, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  })
})
