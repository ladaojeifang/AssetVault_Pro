import { getThumbnailService } from './ThumbnailService'
import { clampThumbnailMaxEdge } from '@/shared/thumbnailPipelineConfig'

/** Current render/output long edge from app preferences (128–512). */
export function getThumbnailRenderPixelSize(): number {
  return getThumbnailService().getGenerationDefaults().width
}

export function getThumbnailGenerationMaxEdge(): number {
  return clampThumbnailMaxEdge(getThumbnailRenderPixelSize())
}
