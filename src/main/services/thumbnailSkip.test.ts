import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./libraryBundle', () => {
  const itemRoot = join(tmpdir(), 'av-thumb-skip-test')
  return {
    itemDirAbsolute: (assetId: string) => join(itemRoot, assetId)
  }
})

import {
  clearThumbnailSkip,
  getThumbnailSkipReason,
  isThumbnailSkippedForPipeline,
  markThumbnailSkipped,
  THUMB_FAILED_MARKER
} from './thumbnailSkip'
import { itemDirAbsolute } from './libraryBundle'

const TEST_ASSET = 'asset-skip-test'

function resetFixture(): void {
  const dir = itemDirAbsolute(TEST_ASSET)
  rmSync(dir, { recursive: true, force: true })
}

describe('thumbnailSkip pipeline isolation', () => {
  beforeEach(() => {
    resetFixture()
    mkdirSync(itemDirAbsolute(TEST_ASSET), { recursive: true })
  })

  afterEach(() => {
    resetFixture()
  })

  it('marks and reads pipeline-specific failure', () => {
    markThumbnailSkipped(TEST_ASSET, 'text-preview', 'render timeout')
    expect(isThumbnailSkippedForPipeline(TEST_ASSET, 'text-preview')).toBe(true)
    expect(isThumbnailSkippedForPipeline(TEST_ASSET, 'model3d')).toBe(false)
    expect(getThumbnailSkipReason(TEST_ASSET)).toBe('render timeout')
    expect(existsSync(join(itemDirAbsolute(TEST_ASSET), THUMB_FAILED_MARKER))).toBe(true)
  })

  it('clears only the matching pipeline marker', () => {
    markThumbnailSkipped(TEST_ASSET, 'text-preview', 'fail')
    clearThumbnailSkip(TEST_ASSET, 'model3d')
    expect(isThumbnailSkippedForPipeline(TEST_ASSET, 'text-preview')).toBe(true)
    clearThumbnailSkip(TEST_ASSET, 'text-preview')
    expect(isThumbnailSkippedForPipeline(TEST_ASSET, 'text-preview')).toBe(false)
  })

  it('treats legacy markers without pipeline prefix as global', () => {
    const marker = join(itemDirAbsolute(TEST_ASSET), THUMB_FAILED_MARKER)
    mkdirSync(itemDirAbsolute(TEST_ASSET), { recursive: true })
    writeFileSync(marker, 'old-reason', 'utf8')
    expect(isThumbnailSkippedForPipeline(TEST_ASSET, 'model3d')).toBe(true)
    expect(isThumbnailSkippedForPipeline(TEST_ASSET, 'embedded-dcc')).toBe(true)
    clearThumbnailSkip(TEST_ASSET, 'text-preview')
    expect(isThumbnailSkippedForPipeline(TEST_ASSET, 'text-preview')).toBe(false)
  })
})
