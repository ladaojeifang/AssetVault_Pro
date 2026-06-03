import { join, extname } from 'path'
import { statSync, renameSync, mkdirSync, copyFileSync } from 'fs'
import { sanitizeStorageFileName } from '../libraryBundle'
import { importAssetFromPath } from '../assetImportService'
import { patchAsset } from '../assetMutationService'
import { getAssetById } from '../assetQueryService'
import { assertBundlePathInSessionDir, removeDirRecursive } from './articleBundleSessionPathPolicy'
import {
  appendArticleBundleFile,
  abortSession,
  beginFinish,
  createArticleBundleSession,
  endSession,
  getArticleBundleSession,
  sessionLimitsPayload,
  deleteSession
} from './articleBundleSessionStore'
import { getLibraryRoot } from '../libraryBundle'
import { getDatabase } from '../../db'
import { assets } from '../../db/schema'
import { eq } from 'drizzle-orm'

function parseOutput(body: Record<string, unknown>) {
  const output = body.output
  if (!output || typeof output !== 'object') throw new Error('INVALID_REQUEST')
  const O = output as Record<string, unknown>
  const filename = typeof O.markdownFilename === 'string' ? O.markdownFilename.trim() : ''
  if (!filename || extname(filename).toLowerCase() !== '.md') throw new Error('INVALID_REQUEST')
  const duplicatePolicy =
    O.duplicatePolicy === 'import_copy' ? 'import_copy' : 'use_existing'
  return {
    markdownFilename: sanitizeStorageFileName(filename),
    targetFolderId:
      typeof O.targetFolderId === 'string' && O.targetFolderId ? O.targetFolderId : null,
    duplicatePolicy: duplicatePolicy as 'use_existing' | 'import_copy' | 'ask'
  }
}

function parseSourceMeta(body: Record<string, unknown>) {
  const sourceMeta = body.sourceMeta
  if (!sourceMeta || typeof sourceMeta !== 'object') {
    return { pageUrl: null, pageTitle: null }
  }
  const S = sourceMeta as Record<string, unknown>
  const pageUrl = typeof S.pageUrl === 'string' ? S.pageUrl.trim() : null
  const pageTitle = typeof S.pageTitle === 'string' ? S.pageTitle.trim() : null
  return { pageUrl, pageTitle }
}

function safeHttpUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
  } catch {
    /* ignore */
  }
  return null
}

export function articleBundleSessionStart(body: Record<string, unknown>) {
  const output = parseOutput(body)
  const sourceMeta = parseSourceMeta(body)
  const optionsRaw =
    body.options && typeof body.options === 'object'
      ? (body.options as Record<string, unknown>)
      : {}

  const session = createArticleBundleSession({
    output,
    sourceMeta,
    options: {
      sessionTtlSeconds: Number(optionsRaw.sessionTtlSeconds) || undefined,
      maxSessionBytes: Number(optionsRaw.maxSessionBytes) || undefined,
      maxSingleFileBytes: Number(optionsRaw.maxSingleFileBytes) || undefined,
      maxAssetFiles: Number(optionsRaw.maxAssetFiles) || undefined
    }
  })

  return {
    sessionId: session.sessionId,
    tempDir: session.tempDir,
    limits: sessionLimitsPayload(),
    expiresAt: session.expiresAt.toISOString()
  }
}

export async function articleBundleSessionAppend(body: Record<string, unknown>) {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  const relativePath = typeof body.relativePath === 'string' ? body.relativePath.trim() : ''
  const filePath = typeof body.filePath === 'string' ? body.filePath : ''

  if (!sessionId || !relativePath || !filePath) {
    throw new Error('INVALID_REQUEST')
  }
  
  if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
    throw new Error('ARTICLE_BUNDLE_PATH_DENIED')
  }

  const session = getArticleBundleSession(sessionId)
  if (!session) throw new Error('ARTICLE_BUNDLE_SESSION_NOT_FOUND')

  const safePath = assertBundlePathInSessionDir(filePath, session.tempDir)
  const st = statSync(safePath)

  const updated = appendArticleBundleFile(sessionId, {
    relativePath: relativePath.replace(/\\/g, '/'),
    filePath: safePath,
    bytes: st.size
  })

  return {
    sessionId: updated.sessionId,
    relativePath,
    bytes: st.size,
    sessionBytes: updated.sessionBytes,
    expiresAt: updated.expiresAt.toISOString()
  }
}

export async function articleBundleSessionFinish(body: Record<string, unknown>) {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  if (!sessionId) throw new Error('INVALID_REQUEST')

  const requiredFiles = body.requiredFiles as Record<string, string> | undefined
  if (!requiredFiles || typeof requiredFiles !== 'object') throw new Error('INVALID_REQUEST')
  
  const markdownReq = requiredFiles.markdown
  const thumbnailReq = requiredFiles.thumbnail
  
  if (!markdownReq || !thumbnailReq) throw new Error('INVALID_REQUEST')

  const session = beginFinish(sessionId)
  const warnings: Array<{ code: string; relativePath?: string; message: string }> = []

  const mdFile = session.files.find(f => f.relativePath === markdownReq)
  const thumbFile = session.files.find(f => f.relativePath === thumbnailReq)

  if (!mdFile || !thumbFile) {
    endSession(sessionId, 'aborted')
    throw new Error('ARTICLE_BUNDLE_INCOMPLETE')
  }

  // Import the markdown file as the primary asset
  let importResult
  try {
    importResult = await importAssetFromPath(mdFile.filePath, {
      targetFolderId: session.output.targetFolderId ?? undefined,
      duplicatePolicy: session.output.duplicatePolicy
    })
  } catch (e) {
    endSession(sessionId, 'aborted')
    throw new Error('IMPORT_FAILED')
  }

  if (importResult.skipped && importResult.existingAssetId) {
    endSession(sessionId, 'finished')
    removeDirRecursive(session.tempDir)
    deleteSession(sessionId)
    return {
      assetId: importResult.existingAssetId,
      skipped: true,
      storagePath: null,
      warnings
    }
  }

  const assetId = importResult.assetId
  if (!assetId) {
    endSession(sessionId, 'aborted')
    throw new Error('IMPORT_FAILED')
  }

  // Now move all other files into the asset's directory
  const libraryRoot = getLibraryRoot()
  const itemDirAbs = join(libraryRoot, 'items', assetId)
  
  try {
    for (const file of session.files) {
      if (file.relativePath === markdownReq) continue // Already imported
      
      const destAbs = join(itemDirAbs, file.relativePath)
      mkdirSync(dirname(destAbs), { recursive: true })
      
      // Use rename to move, fallback to copy if cross-device
      try {
        renameSync(file.filePath, destAbs)
      } catch {
        copyFileSync(file.filePath, destAbs)
      }
      
      if (file.relativePath === thumbnailReq) {
        // Update thumbnail path in DB
        const db = getDatabase()
        await db.update(assets)
          .set({ 
            thumbnailPath: `items/${assetId}/${file.relativePath}`,
            hasThumbnail: true 
          })
          .where(eq(assets.id, assetId))
      }
    }
  } catch (e) {
    console.warn('[ArticleBundle] Failed to move some bundle files:', e)
    warnings.push({ code: 'BUNDLE_MOVE_FAILED', message: String(e) })
  }

  const pageUrl = safeHttpUrl(session.sourceMeta.pageUrl)
  const metaPatch: Record<string, unknown> = {
    captureType: 'article_bundle',
    articleBundleSessionId: session.sessionId,
    filesCount: session.files.length
  }
  if (session.sourceMeta.pageTitle) {
    metaPatch.pageTitle = session.sourceMeta.pageTitle
  }

  const existing = await getAssetById(assetId, { incrementViewCount: false })
  let mergedMeta = metaPatch
  if (existing?.metadata) {
    try {
      const prev = JSON.parse(existing.metadata) as Record<string, unknown>
      mergedMeta = { ...prev, ...metaPatch }
    } catch {
      /* use metaPatch only */
    }
  }

  await patchAsset(assetId, {
    sourceUrl: pageUrl ?? undefined,
    metadata: mergedMeta
  })

  endSession(sessionId, 'finished')
  removeDirRecursive(session.tempDir)
  deleteSession(sessionId)

  return {
    assetId,
    skipped: false,
    storagePath: `items/${assetId}/`,
    warnings
  }
}

export function articleBundleSessionAbort(sessionId: string) {
  const { session, filesRemoved } = abortSession(sessionId)
  return {
    sessionId,
    aborted: true,
    filesRemoved: session ? filesRemoved : 0
  }
}

export function articleBundleSessionGet(sessionId: string) {
  const session = getArticleBundleSession(sessionId)
  if (!session) throw new Error('ARTICLE_BUNDLE_SESSION_NOT_FOUND')
  return {
    sessionId: session.sessionId,
    state: session.state,
    filesCount: session.files.length,
    sessionBytes: session.sessionBytes,
    expiresAt: session.expiresAt.toISOString()
  }
}

function dirname(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (lastSlash === -1) return '.'
  return path.slice(0, lastSlash)
}
