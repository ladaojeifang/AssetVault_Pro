import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { basename, join } from 'path'
import { eq } from 'drizzle-orm'
import { getDatabase } from '../../db'
import { assets } from '../../db/schema'
import type { FontFamilyGroup, FontPreviewRenderRequest, ParsedFontMetadata } from '@/shared/fontTypes'
import { resolveLibraryPath, getLibraryRoot } from '../../services/libraryBundle'
import {
  listFontFacesFromFile,
  parseFontFile
} from '../../services/fontMetadata'
import {
  readFontAppSettings,
  writeFontAppSettings,
  getEffectiveThumbSampleText,
  getEffectiveThumbSampleVersion
} from '../../services/fontSettingsStore'
import { renderFontPreviewPngWithOptions } from '../../utils/fontPreviewRender'
import type { FontAppSettings } from '@/shared/fontSettings'
import { assertFiniteNumber, assertPlainObject, assertString } from '../ipcGuards'

function parseFontMetaFromRow(metadata: string | null | undefined): ParsedFontMetadata | null {
  if (!metadata) return null
  try {
    const parsed = JSON.parse(metadata) as { font?: ParsedFontMetadata }
    return parsed.font ?? null
  } catch {
    return null
  }
}

function installFontToUserWindows(sourcePath: string): { ok: boolean; error?: string; dest?: string } {
  if (process.platform !== 'win32') return { ok: false, error: '当前仅支持 Windows 用户字体目录安装' }
  const local = process.env.LOCALAPPDATA
  if (!local) return { ok: false, error: '无法定位 LOCALAPPDATA' }
  const destDir = join(local, 'Microsoft', 'Windows', 'Fonts')
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
  const dest = join(destDir, basename(sourcePath))
  try {
    copyFileSync(sourcePath, dest)
    return { ok: true, dest }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function handleFontOperations(ipc: typeof ipcMain): void {
  ipc.handle('fonts:get-settings', async () => readFontAppSettings())

  ipc.handle('fonts:set-settings', async (_event, settings: FontAppSettings) => {
    assertPlainObject('settings', settings)
    return writeFontAppSettings(settings)
  })

  ipc.handle('fonts:get-effective-sample-text', async () => ({
    sampleText: getEffectiveThumbSampleText(),
    sampleVersion: getEffectiveThumbSampleVersion()
  }))

  ipc.handle('fonts:list-faces', async (_event, assetId: string) => {
    const database = getDatabase()
    assertString('assetId', assetId)
    const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
    if (!row || row.fileType !== 'font') return []
    const abs = resolveLibraryPath(row.filePath)
    return listFontFacesFromFile(abs)
  })

  ipc.handle('fonts:render-preview', async (_event, req: FontPreviewRenderRequest) => {
    assertPlainObject('req', req)
    assertString('req.filePath', (req as any).filePath)
    try {
      const abs = resolveLibraryPath(req.filePath)
      if (!existsSync(abs)) return { ok: false as const, error: '字体文件不存在' }
      const png = renderFontPreviewPngWithOptions(abs, req)
      if (!png?.length) return { ok: false as const, error: '渲染失败' }
      return {
        ok: true as const,
        dataUrl: `data:image/png;base64,${png.toString('base64')}`
      }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipc.handle(
    'fonts:update-face-index',
    async (_event, assetId: string, ttcIndex: number, reparse = true) => {
      const database = getDatabase()
      assertString('assetId', assetId)
      assertFiniteNumber('ttcIndex', ttcIndex)
      const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
      if (!row || row.fileType !== 'font') return { ok: false as const, error: '不是字体资产' }
      const abs = resolveLibraryPath(row.filePath)
      if (!existsSync(abs)) return { ok: false as const, error: '文件不存在' }

      let metadataObj: Record<string, unknown> = {}
      if (row.metadata) {
        try {
          metadataObj = JSON.parse(row.metadata) as Record<string, unknown>
        } catch {
          metadataObj = {}
        }
      }

      if (reparse) {
        const sampleText = getEffectiveThumbSampleText()
        const parsed = parseFontFile(abs, sampleText, ttcIndex, getEffectiveThumbSampleVersion())
        if (parsed) metadataObj.font = parsed
      } else {
        const font = parseFontMetaFromRow(row.metadata)
        if (font) metadataObj.font = { ...font, ttcIndex }
      }

      await database
        .update(assets)
        .set({
          metadata: JSON.stringify(metadataObj),
          updatedAt: new Date()
        })
        .where(eq(assets.id, assetId))
      return { ok: true as const, font: (metadataObj.font as ParsedFontMetadata) ?? null }
    }
  )

  ipc.handle('fonts:list-family-groups', async () => {
    const database = getDatabase()
    const rows = await database.select().from(assets).where(eq(assets.fileType, 'font')).all()
    const map = new Map<string, FontFamilyGroup>()

    for (const row of rows) {
      const meta = parseFontMetaFromRow(row.metadata)
      const familyName = meta?.familyName ?? row.originalName ?? row.filename
      const key = familyName.trim().toLowerCase() || row.id
      const entry = map.get(key) ?? {
        familyKey: key,
        familyName,
        assets: []
      }
      entry.assets.push({
        id: row.id,
        filename: row.filename,
        subfamilyName: meta?.subfamilyName ?? null,
        ttcIndex: meta?.ttcIndex ?? null
      })
      map.set(key, entry)
    }

    return Array.from(map.values()).sort((a, b) => a.familyName.localeCompare(b.familyName))
  })

  ipc.handle('fonts:install-to-system', async (_event, assetId: string) => {
    const database = getDatabase()
    assertString('assetId', assetId)
    const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
    if (!row || row.fileType !== 'font') return { ok: false as const, error: '不是字体资产' }
    const abs = resolveLibraryPath(row.filePath)
    if (!existsSync(abs)) return { ok: false as const, error: '文件不存在' }
    return installFontToUserWindows(abs)
  })

  ipc.handle('fonts:export-copy', async (event, assetId: string) => {
    const database = getDatabase()
    assertString('assetId', assetId)
    const row = await database.select().from(assets).where(eq(assets.id, assetId)).get()
    if (!row || row.fileType !== 'font') return { ok: false as const, error: '不是字体资产' }
    const abs = resolveLibraryPath(row.filePath)
    if (!existsSync(abs)) return { ok: false as const, error: '文件不存在' }

    const parent = BrowserWindow.fromWebContents(event.sender)
    const r = await dialog.showSaveDialog(parent ?? undefined, {
      defaultPath: row.filename,
      filters: [{ name: 'Font', extensions: ['ttf', 'otf', 'ttc', 'woff', 'woff2'] }]
    })
    if (r.canceled || !r.filePath) return { ok: false as const, error: 'cancelled' }
    try {
      copyFileSync(abs, r.filePath)
      return { ok: true as const, path: r.filePath }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipc.handle('fonts:open-preview-window', async (_event, assetId: string) => {
    assertString('assetId', assetId)
    const wins = BrowserWindow.getAllWindows()
    const main = wins.find((w) => !w.isDestroyed() && w.webContents.getURL().includes('index.html'))
    main?.webContents.send('fonts:open-preview', { assetId })
    if (main) {
      main.focus()
      return { ok: true as const }
    }
    return { ok: false as const, error: '主窗口未找到' }
  })

  ipc.handle('fonts:open-item-folder', async (_event, assetId: string) => {
    assertString('assetId', assetId)
    const dir = join(getLibraryRoot(), 'items', assetId)
    if (!existsSync(dir)) return { ok: false as const, error: '目录不存在' }
    const err = await shell.openPath(dir)
    return err ? { ok: false as const, error: err } : { ok: true as const }
  })
}
