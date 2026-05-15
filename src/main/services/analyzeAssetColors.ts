import { readFileSync, existsSync } from 'fs'
import { extractPaletteFromImageBuffer, serializePaletteColors } from '../utils/colorPalette'
import { extractVideoFramePngBestEffort } from '../utils/videoFrame'

export type AssetColorAnalysis = {
  dominantColor: string
  colors: string[]
  colorsJson: string
}

export async function analyzeColorsFromFile(
  absPath: string,
  fileType: string
): Promise<AssetColorAnalysis | null> {
  if (!existsSync(absPath)) return null

  if (fileType === 'image') {
    const buffer = readFileSync(absPath)
    const { dominantColor, colors } = await extractPaletteFromImageBuffer(buffer)
    return { dominantColor, colors, colorsJson: serializePaletteColors(colors) }
  }

  if (fileType === 'video') {
    const frame = await extractVideoFramePngBestEffort(absPath)
    if (!frame) return null
    const { dominantColor, colors } = await extractPaletteFromImageBuffer(frame)
    return { dominantColor, colors, colorsJson: serializePaletteColors(colors) }
  }

  return null
}
