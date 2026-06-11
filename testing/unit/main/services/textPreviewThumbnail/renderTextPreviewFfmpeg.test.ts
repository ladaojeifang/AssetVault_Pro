import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { renderTextPreviewWebpBuffer } from '@main/services/textPreviewThumbnail/renderTextPreviewFfmpeg'

describe('renderTextPreviewFfmpeg', () => {
  it('renders GBK test.txt to webp without Electron GPU', async () => {
    const samplePath = join(process.cwd(), '3d-thumb-extractor/test/test.txt')
    const buf = await renderTextPreviewWebpBuffer(samplePath, { size: 256, quality: 80 })
    expect(buf?.length).toBeGreaterThan(100)
    expect(buf?.subarray(0, 4).toString('ascii')).toMatch(/^RIFF|^\x89PNG/)
  })
})
