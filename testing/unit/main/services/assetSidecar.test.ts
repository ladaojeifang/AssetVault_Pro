import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeAssetSidecarMeta } from '@main/services/assetSidecar'

describe('assetSidecar type', () => {
  let root = ''

  afterEach(() => {
    if (root) {
      try {
        rmSync(root, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
      root = ''
    }
  })

  it('writeAssetSidecarMeta persists typeId and type', () => {
    root = mkdtempSync(join(tmpdir(), 'av-sidecar-type-'))
    const assetId = 'asset-uuid-1'
    const now = new Date('2026-01-01T00:00:00Z')

    writeAssetSidecarMeta(
      {
        id: assetId,
        filename: 'photo.png',
        originalName: 'photo.png',
        extension: 'png',
        mimeType: 'image/png',
        fileType: 'image',
        typeId: 'cat-1',
        folderId: null,
        filePath: `items/${assetId}/photo.png`,
        fileSize: 1024,
        hasThumbnail: false,
        importedAt: now,
        updatedAt: now
      },
      [{ id: 'tag-1', name: 'refs' }],
      ['folder-1'],
      root,
      { id: 'cat-1', name: 'Concept Art' }
    )

    const metaPath = join(root, 'items', assetId, 'meta.json')
    expect(existsSync(metaPath)).toBe(true)

    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
    expect(meta.typeId).toBe('cat-1')
    expect(meta.type).toEqual({ id: 'cat-1', name: 'Concept Art' })
    expect(meta.tags).toEqual([{ id: 'tag-1', name: 'refs' }])
    expect(meta.folderIds).toEqual(['folder-1'])
  })
})
