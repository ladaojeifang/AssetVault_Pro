import { basename, dirname, extname, existsSync, copyFileSync, readdirSync } from 'fs'
import { join, sep } from 'path'
import { sanitizeStorageFileName } from './libraryBundle'

export function posixRelToFsAbs(libraryRoot: string, rel: string): string {
  return join(libraryRoot, rel.split('/').join(sep))
}

function findCompanionMtlBesideObj(objPath: string): string | null {
  const dir = dirname(objPath)
  const base = basename(objPath, extname(objPath))
  const exact = join(dir, `${base}.mtl`)
  if (existsSync(exact)) return exact

  try {
    const want = `${base}.mtl`.toLowerCase()
    for (const name of readdirSync(dir)) {
      if (name.toLowerCase() === want) return join(dir, name)
    }
  } catch {
    /* ignore */
  }
  return null
}

export function copyObjCompanionMtlForImport(sourceObjPath: string, itemDirAbs: string): void {
  const mtlSource = findCompanionMtlBesideObj(sourceObjPath)
  if (!mtlSource) return

  const mtlName = sanitizeStorageFileName(basename(mtlSource))
  const mtlDest = join(itemDirAbs, mtlName)
  try {
    copyFileSync(mtlSource, mtlDest)
    console.log(`[Import] Copied companion MTL: ${mtlName}`)
  } catch (e) {
    console.warn(`[Import] Failed to copy companion MTL ${basename(mtlSource)}:`, e)
  }
}
