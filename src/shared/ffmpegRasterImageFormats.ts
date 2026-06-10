/** ffmpeg 静帧栅格扩展名 — 配置见 `assetFormatCatalog.ts` IMAGE_FORMAT_GROUPS.ffmpegRaster */

export {
  FFMPEG_STILL_RASTER_IMAGE_EXTENSIONS,
  isFfmpegStillRasterImageExtension,
  isFfmpegStillRasterImagePath,
  normalizeExtWithDot as normalizeImageExtension
} from './assetFormatRegistry'
