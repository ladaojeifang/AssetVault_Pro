import { readFileSync, existsSync } from 'fs'
import { extractPaletteFromImageBuffer, serializePaletteColors } from '../utils/colorPalette'
import {
  extractGifFramePngBestEffort,
  extractVideoFramePngBestEffort,
  isGifFilePath
} from '../utils/videoFrame'

export type AssetColorAnalysis = {
  dominantColor: string
  colors: string[]
  colorsJson: string
}

async function loadRasterForColorAnalysis(
  absPath: string,
  fileType: string,
  absThumbnailPath?: string
): Promise<Buffer | null> {
  if (fileType === 'video' && existsSync(absPath)) {
    return extractVideoFramePngBestEffort(absPath)
  }

  if (fileType === 'image' && existsSync(absPath)) {
    if (isGifFilePath(absPath)) {
      return extractGifFramePngBestEffort(absPath)
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
  absThumbnailPath?: string
): Promise<AssetColorAnalysis | null> {
  const buffer = await loadRasterForColorAnalysis(absPath, fileType, absThumbnailPath)
  if (!buffer) return null

  const { dominantColor, colors } = await extractPaletteFromImageBuffer(buffer)
  return { dominantColor, colors, colorsJson: serializePaletteColors(colors) }
}
