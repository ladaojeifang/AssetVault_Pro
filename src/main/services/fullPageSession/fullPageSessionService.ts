import { join, extname } from 'path'
import { existsSync, statSync } from 'fs'
import { sanitizeStorageFileName } from '../libraryBundle'
import { importAssetFromPath } from '../assetImportService'
import { patchAsset } from '../assetMutationService'
import { getAssetById } from '../assetQueryService'
import type { FullPageOutputFormat, FullPageWarningCode } from '@/shared/fullPageSessionTypes'
import {
  assertStripPathInSessionDir,
  markSessionDirPreserved
} from './fullPageSessionPathPolicy'
import {
  appendFullPageStrip,
  abortSession,
  beginFinish,
  createFullPageSession,
  deleteSession,
  endSession,
  getFullPageSession,
  sessionLimitsPayload,
  touchSessionExpiry,
  type FullPageSessionRecord
} from './fullPageSessionStore'
import {
  readStripDimensions,
  stitchVerticalToFile,
  type StripInput
} from './fullPageStitchService'
import { removeDirRecursive } from './fullPageSessionPathPolicy'
import { writeStripFromDataUrl } from './fullPageSessionStripWrite'

function parseLayout(body: Record<string, unknown>) {
  const layout = body.layout
  if (!layout || typeof layout !== 'object') throw new Error('INVALID_REQUEST')
  const L = layout as Record<string, unknown>
  const widthPx = Number(L.widthPx)
  const contentHeightPx = Number(L.contentHeightPx)
  const stripHeightsPx = Array.isArray(L.stripHeightsPx)
    ? L.stripHeightsPx.map((n) => Number(n))
    : []
  if (!Number.isFinite(widthPx) || widthPx <= 0) throw new Error('INVALID_REQUEST')
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) throw new Error('INVALID_REQUEST')
  if (stripHeightsPx.some((n) => !Number.isFinite(n) || n <= 0)) throw new Error('INVALID_REQUEST')
  return {
    widthPx: Math.floor(widthPx),
    contentHeightPx: Math.floor(contentHeightPx),
    stripHeightsPx: stripHeightsPx.map((n) => Math.floor(n)),
    overlapPx: Math.max(0, Math.floor(Number(L.overlapPx) || 0)),
    devicePixelRatio: Math.max(1, Number(L.devicePixelRatio) || 1)
  }
}

function parseOutput(body: Record<string, unknown>) {
  const output = body.output
  if (!output || typeof output !== 'object') throw new Error('INVALID_REQUEST')
  const O = output as Record<string, unknown>
  const filename = typeof O.filename === 'string' ? O.filename.trim() : ''
  if (!filename) throw new Error('INVALID_REQUEST')
  const ext = extname(filename).toLowerCase()
  const format: FullPageOutputFormat =
    O.format === 'png' || ext === '.png' ? 'png' : 'jpeg'
  const quality = Math.min(100, Math.max(1, Math.floor(Number(O.quality) || 92)))
  const duplicatePolicy =
    O.duplicatePolicy === 'import_copy' ? 'import_copy' : 'use_existing'
  return {
    filename: sanitizeStorageFileName(filename),
    format,
    quality,
    targetFolderId:
      typeof O.targetFolderId === 'string' && O.targetFolderId ? O.targetFolderId : null,
    duplicatePolicy: duplicatePolicy as 'use_existing' | 'import_copy'
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

export function fullPageSessionStart(body: Record<string, unknown>) {
  const layout = parseLayout(body)
  const output = parseOutput(body)
  const sourceMeta = parseSourceMeta(body)
  const optionsRaw =
    body.options && typeof body.options === 'object'
      ? (body.options as Record<string, unknown>)
      : {}

  const sessionIdOpt =
    typeof optionsRaw.sessionId === 'string' ? optionsRaw.sessionId.trim() : undefined

  const session = createFullPageSession({
    layout,
    output,
    sourceMeta,
    options: {
      sessionId: sessionIdOpt,
      maxOutputPixels: Number(optionsRaw.maxOutputPixels) || undefined,
      maxOutputSide: Number(optionsRaw.maxOutputSide) || undefined,
      sessionTtlSeconds: Number(optionsRaw.sessionTtlSeconds) || undefined
    }
  })

  return {
    sessionId: session.sessionId,
    tempDir: session.tempDir,
    limits: sessionLimitsPayload(),
    expiresAt: session.expiresAt.toISOString()
  }
}

export async function fullPageSessionAppend(body: Record<string, unknown>) {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  if (!sessionId) throw new Error('INVALID_REQUEST')

  const stripIndex = Number(body.stripIndex)
  const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : ''
  const stripDataUrl = typeof body.stripDataUrl === 'string' ? body.stripDataUrl.trim() : ''
  const stripHeightPx = Number(body.stripHeightPx)
  if (!Number.isFinite(stripIndex) || stripIndex < 0) throw new Error('INVALID_REQUEST')
  if (!filePath && !stripDataUrl) throw new Error('INVALID_REQUEST')
  if (!Number.isFinite(stripHeightPx) || stripHeightPx <= 0) throw new Error('INVALID_REQUEST')

  const session = getFullPageSession(sessionId)
  if (!session) throw new Error('FULLPAGE_SESSION_NOT_FOUND')
  if (session.state === 'expired' || session.expiresAt < new Date()) {
    throw new Error('FULLPAGE_SESSION_EXPIRED')
  }
  if (session.state !== 'collecting') {
    if (session.state === 'finishing') throw new Error('FULLPAGE_SESSION_BUSY')
    throw new Error('FULLPAGE_SESSION_NOT_FOUND')
  }

  const safePath = stripDataUrl
    ? writeStripFromDataUrl(
        session.tempDir,
        Math.floor(stripIndex),
        stripDataUrl,
        session.output.format
      )
    : assertStripPathInSessionDir(filePath, session.tempDir)
  const st = statSync(safePath)
  const bytes = st.size

  const dims = await readStripDimensions(safePath)
  const expectedW = session.layout.widthPx
  const stripWidthPx = Number(body.stripWidthPx) || expectedW
  if (Math.abs(dims.width - expectedW) > 1) {
    throw new Error('FULLPAGE_STRIP_DIMENSION_MISMATCH')
  }
  if (stripHeightPx > dims.height) {
    throw new Error('FULLPAGE_STRIP_DIMENSION_MISMATCH')
  }

  const updated = appendFullPageStrip(sessionId, {
    stripIndex: Math.floor(stripIndex),
    filePath: safePath,
    widthPx: dims.width,
    stripHeightPx: Math.floor(stripHeightPx),
    bytes
  })

  return {
    sessionId: updated.sessionId,
    stripIndex: Math.floor(stripIndex),
    stripsReceived: updated.strips.length,
    sessionBytes: updated.sessionBytes,
    expiresAt: updated.expiresAt.toISOString()
  }
}

export async function fullPageSessionFinish(body: Record<string, unknown>) {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  if (!sessionId) throw new Error('INVALID_REQUEST')

  const session = beginFinish(sessionId)
  const timingMs: { stitch?: number; import?: number } = {}
  const warnings: FullPageWarningCode[] = []

  const layoutBody =
    body.layout && typeof body.layout === 'object'
      ? (body.layout as Record<string, unknown>)
      : {}
  const contentHeightPx = Number(layoutBody.contentHeightPx) || session.layout.contentHeightPx
  let overlapPx = Math.max(0, Math.floor(Number(layoutBody.overlapPx) ?? session.layout.overlapPx))

  const optionsBody =
    body.options && typeof body.options === 'object'
      ? (body.options as Record<string, unknown>)
      : {}
  const allowPartial = optionsBody.allowPartial !== false
  const deleteAfter = optionsBody.deleteSessionFilesAfter === true

  const strips: StripInput[] = session.strips
    .slice()
    .sort((a, b) => a.stripIndex - b.stripIndex)
    .map((s) => ({
      filePath: s.filePath,
      stripHeightPx: s.stripHeightPx,
      widthPx: s.widthPx
    }))

  const ext = session.output.format === 'png' ? '.png' : '.jpg'
  const outName = session.output.filename.endsWith(ext)
    ? session.output.filename
    : session.output.filename.replace(/\.[^.]+$/, '') + ext
  const outputPath = join(session.tempDir, outName)

  const stitchStart = Date.now()
  let stitchResult
  try {
    stitchResult = await stitchVerticalToFile(strips, {
      widthPx: session.layout.widthPx,
      heightPx: contentHeightPx,
      overlapPx,
      maxOutputPixels: session.options.maxOutputPixels,
      maxOutputSide: session.options.maxOutputSide,
      maxOutputBytes: session.options.maxOutputBytes,
      format: session.output.format,
      quality: session.output.quality,
      plannedStripCount: session.layout.stripHeightsPx.length,
      allowPartial
    }, outputPath)
  } catch (e) {
    endSession(sessionId, 'aborted')
    if (!deleteAfter) {
      markSessionDirPreserved(session.tempDir, {
        sessionId,
        failed: 'stitch',
        stripFiles: session.strips.map((s) => s.filePath)
      })
      deleteSession(sessionId)
    } else {
      removeDirRecursive(session.tempDir)
      deleteSession(sessionId)
    }
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith('FULLPAGE_')) throw e
    throw new Error('FULLPAGE_STITCH_FAILED')
  }
  timingMs.stitch = Date.now() - stitchStart
  warnings.push(...stitchResult.warnings)

  const importStart = Date.now()
  let importResult
  try {
    importResult = await importAssetFromPath(outputPath, {
      targetFolderId: session.output.targetFolderId ?? undefined,
      duplicatePolicy: session.output.duplicatePolicy
    })
  } catch (e) {
    endSession(sessionId, 'aborted')
    if (!deleteAfter) {
      markSessionDirPreserved(session.tempDir, {
        sessionId,
        failed: 'import',
        mergedOutputPath: outputPath,
        stripFiles: session.strips.map((s) => s.filePath)
      })
      deleteSession(sessionId)
    }
    throw new Error('IMPORT_FAILED')
  }
  timingMs.import = Date.now() - importStart

  if (importResult.skipped && importResult.existingAssetId) {
    endSession(sessionId, 'finished')
    if (deleteAfter) {
      removeDirRecursive(session.tempDir)
      deleteSession(sessionId)
    } else {
      markSessionDirPreserved(session.tempDir, {
        sessionId,
        assetId: importResult.existingAssetId,
        mergedOutputPath: outputPath,
        stripFiles: session.strips.map((s) => s.filePath)
      })
      deleteSession(sessionId)
    }
    return {
      assetId: importResult.existingAssetId,
      skipped: true,
      existingAssetId: importResult.existingAssetId,
      output: {
        widthPx: stitchResult.widthPx,
        heightPx: stitchResult.heightPx,
        format: stitchResult.format,
        fileBytes: stitchResult.fileBytes,
        scaledDown: stitchResult.scaledDown
      },
      stripsUsed: strips.length,
      warnings,
      timingMs,
      tempDir: deleteAfter ? null : session.tempDir,
      stripsPreserved: !deleteAfter,
      stripFiles: deleteAfter ? undefined : session.strips.map((s) => s.filePath)
    }
  }

  const assetId = importResult.assetId
  if (!assetId) {
    endSession(sessionId, 'aborted')
    throw new Error('IMPORT_FAILED')
  }

  const pageUrl = safeHttpUrl(session.sourceMeta.pageUrl)
  const metaPatch: Record<string, unknown> = {
    captureType: 'fullpage',
    fullPageSessionId: session.sessionId,
    stripsCount: strips.length,
    devicePixelRatio: session.layout.devicePixelRatio
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
  if (deleteAfter) {
    removeDirRecursive(session.tempDir)
    deleteSession(sessionId)
    console.log(`[FullPageSession] removed tempDir after finish: ${session.tempDir}`)
  } else {
    markSessionDirPreserved(session.tempDir, {
      sessionId,
      assetId,
      mergedOutputPath: outputPath,
      stripFiles: session.strips.map((s) => s.filePath)
    })
    deleteSession(sessionId)
    console.log(`[FullPageSession] strips preserved at ${session.tempDir}`)
  }

  return {
    assetId,
    skipped: false,
    existingAssetId: null,
    output: {
      widthPx: stitchResult.widthPx,
      heightPx: stitchResult.heightPx,
      format: stitchResult.format,
      fileBytes: stitchResult.fileBytes,
      scaledDown: stitchResult.scaledDown
    },
    stripsUsed: strips.length,
    warnings,
    timingMs,
    tempDir: deleteAfter ? null : session.tempDir,
    stripsPreserved: !deleteAfter,
    stripFiles: deleteAfter ? undefined : session.strips.map((s) => s.filePath)
  }
}

export function fullPageSessionAbort(sessionId: string) {
  const { session, filesRemoved } = abortSession(sessionId)
  return {
    sessionId,
    aborted: true,
    filesRemoved: session ? filesRemoved : 0
  }
}

export function fullPageSessionGet(sessionId: string) {
  const session = getFullPageSession(sessionId)
  if (!session) throw new Error('FULLPAGE_SESSION_NOT_FOUND')
  touchSessionExpiry(session)
  return serializeSessionView(session)
}

function serializeSessionView(session: FullPageSessionRecord) {
  return {
    sessionId: session.sessionId,
    state: session.state,
    stripsReceived: session.strips.length,
    plannedStrips: session.layout.stripHeightsPx.length,
    sessionBytes: session.sessionBytes,
    expiresAt: session.expiresAt.toISOString(),
    startedAt: session.startedAt.toISOString(),
    lastAppendAt: session.lastAppendAt?.toISOString() ?? null,
    tempDir: session.tempDir,
    limits: sessionLimitsPayload()
  }
}
