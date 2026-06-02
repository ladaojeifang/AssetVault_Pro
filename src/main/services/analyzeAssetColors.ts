import { readFileSync, existsSync } from 'fs'
import { isSvgFilePath } from '@/shared/svgFormats'
import { isExrFilePath } from '@/shared/exrFormats'
import { renderExrThumbnailWebp } from './exrThumbnailRender'
import { extractPaletteFromImageBuffer, serializePaletteColors } from '../utils/colorPalette'
import {
  extractGifFramePngBestEffort,
  extractVideoFramePngBestEffort,
  isGifFilePath
} from '../utils/videoFrame'
import { renderSvgToWebpBuffer } from './svgThumbnailRenderer'
import { isSvgRasterSkipped } from './svgRasterSkip'

export type AssetColorAnalysis = {
  dominantColor: string
  colors: string[]
  colorsJson: string
}

async function loadRasterForColorAnalysis(
  absPath: string,
  fileType: string,
  absThumbnailPath?: string,
  assetId?: string
): Promise<Buffer | null> {
  if (fileType === 'video' && existsSync(absPath)) {
    return extractVideoFramePngBestEffort(absPath)
  }

  if (fileType === 'image' && existsSync(absPath)) {
    if (isSvgFilePath(absPath)) {
      if (assetId && isSvgRasterSkipped(assetId)) {
        return null
      }
      if (absThumbnailPath && existsSync(absThumbnailPath)) {
        try {
          return readFileSync(absThumbnailPath)
        } catch {
          /* fall through */
        }
      }
      return renderSvgToWebpBuffer(absPath)
    }
    if (isGifFilePath(absPath)) {
      return extractGifFramePngBestEffort(absPath)
    }
    if (isExrFilePath(absPath)) {
      if (absThumbnailPath && existsSync(absThumbnailPath)) {
        try {
          return readFileSync(absThumbnailPath)
        } catch {
          /* fall through */
        }
      }
      return renderExrThumbnailWebp(absPath, 80, 80)
    }
    return readFileSync(absPath)
  }

  if (absThumbnailPath && existsSync(absThumbnailPath)) {
    try {
      return readFileSync(absThumbnailPath)
    } catch {
      /* fall through */
    }
  }

  return null
}

export async function analyzeColorsFromFile(
  absPath: string,
  fileType: string,
  absThumbnailPath?: string,
  assetId?: string
): Promise<AssetColorAnalysis | null> {
  try {
    const buffer = await loadRasterForColorAnalysis(absPath, fileType, absThumbnailPath, assetId)
    if (!buffer?.length) return null

    const { dominantColor, colors } = await extractPaletteFromImageBuffer(buffer)
    return { dominantColor, colors, colorsJson: serializePaletteColors(colors) }
  } catch (e) {
    console.warn('[analyzeColors] failed:', absPath, e)
    return null
  }
}
