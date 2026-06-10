import { Transformer, ResizeFit } from '@napi-rs/image'
import { LRUCache } from 'lru-cache'
import { app } from 'electron'
import { join, basename } from 'path'
import { existsSync, mkdirSync, unlinkSync, statSync, readdirSync, writeFileSync, renameSync, readFileSync } from 'fs'
import {
  extractGifFramePngBestEffort,
  extractVideoFramePngBestEffort,
  isGifFilePath
} from '../utils/videoFrame'
import { renderModelToPngBuffer } from './modelThumbnailRenderer'
import { renderFontPreviewPng, FONT_THUMB_CANVAS_SIZE } from '../utils/fontPreviewRender'
import { FONT_THUMB_SAMPLE_TEXT } from '@/shared/fontTypes'
import {
  isModelThumbnailSkipped,
  markModelThumbnailSkipped,
  clearModelThumbnailSkip
} from './modelThumbnailSkip'
import { parseModel3dFormat } from '@/shared/model3dFormats'
import { isTextPreviewExtension } from '@/shared/textPreviewFormats'
import { isEmbeddedDccThumbExtension } from '@/shared/embeddedDccFormats'
import { isSvgFilePath } from '@/shared/svgFormats'
import { isExrFilePath } from '@/shared/exrFormats'
import { renderExrThumbnailWebp } from './exrThumbnailRender'
import { isCustomThumbnail } from './customThumbnail'
import { articleBundleThumbAbs } from './thumbnailRead'
import { renderSvgToWebpBuffer } from './svgThumbnailRenderer'
import { isSvgRasterSkipped } from './svgRasterSkip'
import {
  THUMBNAIL_MAX_EDGE,
  bufferToImageDataUrl,
  shouldUseOriginalImageDimensions
} from '../utils/thumbnailSizing'

export type ThumbnailGenerateResult = {
  buffer: Buffer
  /** thumb.webp path, or source image path when `usedOriginal` */
  path: string
  usedOriginal?: boolean
}

/** Max source file size to load into memory for thumbnail generation (500MB).
 *  Larger files are skipped to prevent OOM. */
const MAX_SOURCE_FILE_SIZE = 500 * 1024 * 1024

/**
 * Three-level Thumbnail Cache System
 * Level 1: In-memory LRU cache (fastest, ~1000 entries)
 * Level 2: Disk cache (per-asset thumb under library items/ or legacy userData/thumbnails)
 * Level 3: Database (thumbnail_path reference)
 */
export class ThumbnailService {
  private lruCache: LRUCache<string, Buffer>
  private thumbDirLegacy: string
  private libraryRoot: string | null = null
  private maxMemorySize: number // MB
  private maxDiskSize: number // MB
  private generationMaxEdge = THUMBNAIL_MAX_EDGE
  private generationQuality = 80

  constructor(options?: { maxMemoryMB?: number; maxDiskMB?: number }) {
    this.maxMemorySize = options?.maxMemoryMB ?? 256 // 256MB memory cache
    this.maxDiskSize = options?.maxDiskMB ?? 2048 // 2GB disk cache
    this.thumbDirLegacy = join(app.getPath('userData'), 'thumbnails')

    if (!existsSync(this.thumbDirLegacy)) {
      mkdirSync(this.thumbDirLegacy, { recursive: true })
    }

    this.lruCache = this.createLruCache()

    console.log(
      `[ThumbnailService] Initialized - Memory: ${this.maxMemorySize}MB, legacy dir: ${this.thumbDirLegacy}`
    )
  }

  /** When set, new thumbnails are written to {libraryRoot}/items/{assetId}/thumb.webp */
  setLibraryRoot(root: string | null): void {
    this.libraryRoot = root ? root : null
    console.log(`[ThumbnailService] Library root: ${this.libraryRoot ?? '(legacy userData thumbs only)'}`)
  }

  setGenerationDefaults(opts: { maxEdge: number; quality: number }): void {
    this.generationMaxEdge = Math.min(512, Math.max(128, Math.floor(opts.maxEdge)))
    this.generationQuality = Math.min(100, Math.max(10, Math.floor(opts.quality)))
  }

  getGenerationDefaults(): { width: number; height: number; quality: number } {
    return {
      width: this.generationMaxEdge,
      height: this.generationMaxEdge,
      quality: this.generationQuality
    }
  }

  private createLruCache(): LRUCache<string, Buffer> {
    return new LRUCache<string, Buffer>({
      maxSize: this.maxMemorySize * 1024 * 1024,
      sizeCalculation: (value) => value.length,
      ttl: 1000 * 60 * 30 // 30 min TTL for memory
    })
  }

  /** Resize in-memory LRU cap (recreates cache when limit changes). */
  setMemoryCacheLimitMB(mb: number): void {
    const next = Math.min(10240, Math.max(256, Math.floor(mb)))
    if (next === this.maxMemorySize) return
    this.maxMemorySize = next
    this.lruCache = this.createLruCache()
    console.log(`[ThumbnailService] Memory cache limit: ${next}MB`)
  }

  private thumbDiskPath(assetId: string): string {
    if (this.libraryRoot) {
      const dir = join(this.libraryRoot, 'items', assetId)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      return join(dir, 'thumb.webp')
    }
    return join(this.thumbDirLegacy, `${assetId}.webp`)
  }

  /** Raster frame (video / GIF) ? thumb.webp via ffmpeg + @napi-rs/image. */
  private async generateFromFfmpegFrame(
    filePath: string,
    assetId: string,
    options: { width?: number; height?: number; quality?: number },
    extractFrame: (path: string) => Promise<Buffer | null>
  ): Promise<ThumbnailGenerateResult | null> {
    const maxEdge = options.width ?? this.generationMaxEdge
    const { height = maxEdge, quality = options.quality ?? this.generationQuality } = options
    const outputPath = this.thumbDiskPath(assetId)

    if (existsSync(outputPath)) {
      const diskBuffer = readFileSync(outputPath)
      this.lruCache.set(assetId, diskBuffer)
      return { buffer: diskBuffer, path: outputPath }
    }

    const png = await extractFrame(filePath)
    if (!png) {
      if (isGifFilePath(filePath)) {
        console.warn(`[ThumbnailService] GIF frame extract failed (ffmpeg): ${filePath}`)
      }
      return null
    }

    const transformer = new Transformer(png)
    const frameInfo = await transformer.metadata()
    const webpBuffer = shouldUseOriginalImageDimensions(frameInfo.width, frameInfo.height)
      ? await transformer.webp(quality)
      : await transformer.resize(maxEdge, height, undefined, ResizeFit.Inside).webp(quality)

    writeFileSafely(outputPath, webpBuffer as Buffer)
    this.lruCache.set(assetId, webpBuffer as Buffer)
    return { buffer: webpBuffer as Buffer, path: outputPath }
  }

  /**
   * Generate thumbnail for an image file using @napi-rs/image
   */
  async generate(
    filePath: string,
    assetId: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    // Check memory cache first
    const memCached = this.lruCache.get(assetId)
    if (memCached) {
      console.debug(`[ThumbnailService] L1 memory hit: ${basename(filePath)}`)
      return { buffer: memCached, path: this.thumbDiskPath(assetId) }
    }

    if (isSvgFilePath(filePath)) {
      return this.generateSvg(filePath, assetId, options)
    }

    if (isExrFilePath(filePath)) {
      return this.generateExr(filePath, assetId, options)
    }

    const startTime = performance.now()
    const maxEdge = options.width ?? this.generationMaxEdge
    const { height = maxEdge, quality = options.quality ?? this.generationQuality } = options

    try {
      if (isGifFilePath(filePath)) {
        const result = await this.generateFromFfmpegFrame(
          filePath,
          assetId,
          options,
          extractGifFramePngBestEffort
        )
        console.debug(`[ThumbnailService] GIF thumb ${result ? 'OK' : 'FAIL'}: ${basename(filePath)} (${(performance.now() - startTime).toFixed(0)}ms)`)
        return result
      }

      if (isCustomThumbnail(assetId)) {
        const customPath = this.thumbDiskPath(assetId)
        if (existsSync(customPath)) {
          const diskBuffer = readFileSync(customPath)
          this.lruCache.set(assetId, diskBuffer)
          return { buffer: diskBuffer, path: customPath }
        }
      }

      // Guard against loading huge files into memory (PSD / TIFF / large PNG)
      try {
        const sourceStat = statSync(filePath)
        if (sourceStat.size > MAX_SOURCE_FILE_SIZE) {
          console.warn(
            `[ThumbnailService] Skipping oversized source (${(sourceStat.size / 1024 / 1024).toFixed(1)}MB > ${MAX_SOURCE_FILE_SIZE / 1024 / 1024}MB): ${filePath}`
          )
          return null
        }
      } catch {
        // stat failed — let readFileSync handle the error naturally
      }
      const fileBuffer = readFileSync(filePath)
      const transformer = new Transformer(fileBuffer)
      const imgInfo = await transformer.metadata()

      if (shouldUseOriginalImageDimensions(imgInfo.width, imgInfo.height)) {
        this.lruCache.set(assetId, fileBuffer)
        console.debug(`[ThumbnailService] Image small, using original: ${basename(filePath)} (${imgInfo.width}x${imgInfo.height})`)
        return { buffer: fileBuffer, path: filePath, usedOriginal: true }
      }

      const outputPath = this.thumbDiskPath(assetId)
      if (existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        console.debug(`[ThumbnailService] L2 disk hit: ${basename(filePath)}`)
        return { buffer: diskBuffer, path: outputPath }
      }

      const webpBuffer = await transformer
        .resize(maxEdge, height, undefined, ResizeFit.Inside)
        .webp(quality)

      writeFileSafely(outputPath, webpBuffer as Buffer)
      this.lruCache.set(assetId, webpBuffer as Buffer)

      console.debug(`[ThumbnailService] Image thumb OK: ${basename(filePath)} (${imgInfo.width}x${imgInfo.height}→${maxEdge}, ${(performance.now() - startTime).toFixed(0)}ms)`)
      return { buffer: webpBuffer as Buffer, path: outputPath }
    } catch (error) {
      console.error(`[ThumbnailService] Failed to generate thumbnail for ${filePath}:`, error)
      return null
    }
  }

  /** EXR (HDR float) → exrs default layer → WebP; falls back to napi/ffmpeg. */
  async generateExr(
    filePath: string,
    assetId: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    const maxEdge = options.width ?? this.generationMaxEdge
    const quality = options.quality ?? this.generationQuality
    const outputPath = this.thumbDiskPath(assetId)

    try {
      if (isCustomThumbnail(assetId) && existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      if (existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      const webpBuffer = await renderExrThumbnailWebp(filePath, maxEdge, quality)
      if (!webpBuffer?.length) return null

      writeFileSafely(outputPath, webpBuffer)
      this.lruCache.set(assetId, webpBuffer)
      return { buffer: webpBuffer, path: outputPath }
    } catch (error) {
      console.error(`[ThumbnailService] Failed to generate EXR thumbnail for ${filePath}:`, error)
      return null
    }
  }

  /** SVG → WebP via sandboxed hidden Chromium window. */
  async generateSvg(
    filePath: string,
    assetId: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    if (isSvgRasterSkipped(assetId)) {
      return null
    }

    const maxEdge = options.width ?? this.generationMaxEdge
    const quality = options.quality ?? this.generationQuality
    const outputPath = this.thumbDiskPath(assetId)

    try {
      if (isCustomThumbnail(assetId) && existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      if (existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      const webpBuffer = await renderSvgToWebpBuffer(filePath, {
        size: maxEdge,
        quality
      })
      if (!webpBuffer?.length) return null

      writeFileSafely(outputPath, webpBuffer)
      this.lruCache.set(assetId, webpBuffer)
      return { buffer: webpBuffer, path: outputPath }
    } catch (error) {
      console.error(`[ThumbnailService] Failed to generate SVG thumbnail for ${filePath}:`, error)
      return null
    }
  }

  /**
   * Generate thumbnail for 3D models (GLB/GLTF/OBJ/STL/FBX) via hidden WebGL window.
   */
  async generateModel(
    filePath: string,
    assetId: string,
    ext: string,
    options: { width?: number; height?: number; quality?: number; force?: boolean } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    const maxEdge = options.width ?? this.generationMaxEdge
    const { height = maxEdge, quality = options.quality ?? this.generationQuality, force = false } = options
    const outputPath = this.thumbDiskPath(assetId)

    if (!parseModel3dFormat(ext)) {
      console.warn(`[ThumbnailService] Unsupported 3D extension: ${ext}`)
      return null
    }

    if (force) {
      clearModelThumbnailSkip(assetId)
      this.invalidate(assetId)
    } else if (isModelThumbnailSkipped(assetId)) {
      return null
    }

    try {
      if (!force && existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      const png = await renderModelToPngBuffer(filePath, ext)
      if (!png?.length) {
        console.warn(`[ThumbnailService] 3D render returned empty for ${filePath}`)
        return null
      }

      const transformer = new Transformer(png)
      const webpBuffer = await transformer
        .resize(maxEdge, height, undefined, ResizeFit.Inside)
        .webp(quality)

      writeFileSafely(outputPath, webpBuffer as Buffer)
      this.lruCache.set(assetId, webpBuffer as Buffer)
      return { buffer: webpBuffer as Buffer, path: outputPath }
    } catch (error) {
      console.warn(`[ThumbnailService] 3D thumbnail failed for ${filePath}:`, error)
      return null
    }
  }

  /** Extract embedded thumbnail from C4D/Max/Blend DCC files. */
  async generateEmbeddedDcc(
    filePath: string,
    assetId: string,
    ext: string,
    options: { width?: number; height?: number; quality?: number; force?: boolean } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    const maxEdge = options.width ?? this.generationMaxEdge
    const { quality = options.quality ?? this.generationQuality, force = false } = options
    const outputPath = this.thumbDiskPath(assetId)
    const dotExt = ext.startsWith('.') ? ext : `.${ext}`

    if (!isEmbeddedDccThumbExtension(dotExt)) {
      return null
    }

    if (force) {
      this.invalidate(assetId)
    } else if (existsSync(outputPath)) {
      const diskBuffer = readFileSync(outputPath)
      this.lruCache.set(assetId, diskBuffer)
      return { buffer: diskBuffer, path: outputPath }
    }

    try {
      const { extractEmbeddedDccThumbnail } = await import(
        './embeddedDccThumbnail/extractEmbeddedDcc'
      )
      const result = await extractEmbeddedDccThumbnail(filePath)
      if (!result.ok || !result.buffer?.length) {
        return null
      }

      const transformer = new Transformer(result.buffer)
      const webpBuffer = await transformer
        .resize(maxEdge, maxEdge, undefined, ResizeFit.Inside)
        .webp(quality)

      writeFileSafely(outputPath, webpBuffer as Buffer)
      this.lruCache.set(assetId, webpBuffer as Buffer)
      return { buffer: webpBuffer as Buffer, path: outputPath }
    } catch (error) {
      console.warn(`[ThumbnailService] Embedded DCC thumbnail failed for ${filePath}:`, error)
      return null
    }
  }

  /** Paper-style preview for .json / .md / .txt → WebP via ffmpeg subprocess. */
  async generateTextPreview(
    filePath: string,
    assetId: string,
    ext: string,
    options: { width?: number; height?: number; quality?: number; force?: boolean } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    const maxEdge = options.width ?? this.generationMaxEdge
    const { quality = options.quality ?? this.generationQuality, force = false } = options
    const outputPath = this.thumbDiskPath(assetId)
    const dotExt = ext.startsWith('.') ? ext : `.${ext}`

    if (!isTextPreviewExtension(dotExt)) {
      return null
    }

    const bundleThumbPath = articleBundleThumbAbs(assetId)
    if (existsSync(bundleThumbPath)) {
      const diskBuffer = readFileSync(bundleThumbPath)
      this.lruCache.set(assetId, diskBuffer)
      return { buffer: diskBuffer, path: bundleThumbPath }
    }

    if (force) {
      this.invalidate(assetId)
    } else if (existsSync(outputPath)) {
      const diskBuffer = readFileSync(outputPath)
      this.lruCache.set(assetId, diskBuffer)
      return { buffer: diskBuffer, path: outputPath }
    }

    try {
      const { renderTextPreviewWebpBuffer } = await import(
        './textPreviewThumbnail/renderTextPreviewFfmpeg'
      )
      const webpBuffer = await renderTextPreviewWebpBuffer(filePath, {
        size: maxEdge,
        quality
      })
      if (!webpBuffer?.length) {
        return null
      }

      writeFileSafely(outputPath, webpBuffer as Buffer)
      this.lruCache.set(assetId, webpBuffer as Buffer)
      return { buffer: webpBuffer as Buffer, path: outputPath }
    } catch (error) {
      console.warn(`[ThumbnailService] Text preview thumbnail failed for ${filePath}:`, error)
      return null
    }
  }

  /** Font preview thumbnail ??renders sample text via fontkit + Skia canvas. */
  async generateFont(
    filePath: string,
    assetId: string,
    options: {
      width?: number
      height?: number
      quality?: number
      sampleText?: string
      ttcIndex?: number
      /** Delete existing thumb.webp and bypass disk cache. */
      force?: boolean
    } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    const size = options.width ?? options.height ?? FONT_THUMB_CANVAS_SIZE
    const { quality = 85, force = false, ttcIndex = 0 } = options
    const outputPath = this.thumbDiskPath(assetId)

    try {
      if (force) {
        this.invalidate(assetId)
      } else if (existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      const png = renderFontPreviewPng(
        filePath,
        options.sampleText ?? FONT_THUMB_SAMPLE_TEXT,
        ttcIndex
      )
      if (!png?.length) return null

      const transformer = new Transformer(png)
      const webpBuffer = await transformer
        .resize(size, size, undefined, ResizeFit.Inside)
        .webp(quality)

      writeFileSafely(outputPath, webpBuffer as Buffer)
      this.lruCache.set(assetId, webpBuffer as Buffer)
      return { buffer: webpBuffer as Buffer, path: outputPath }
    } catch (error) {
      console.error(`[ThumbnailService] Failed to generate font thumbnail for ${filePath}:`, error)
      return null
    }
  }

  async generateVideo(
    filePath: string,
    assetId: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    try {
      return await this.generateFromFfmpegFrame(
        filePath,
        assetId,
        options,
        extractVideoFramePngBestEffort
      )
    } catch (error) {
      console.error(`[ThumbnailService] Failed to generate video thumbnail for ${filePath}:`, error)
      return null
    }
  }

  async get(assetId: string, filePath: string): Promise<Buffer | null> {
    const memCached = this.lruCache.get(assetId)
    if (memCached) return memCached

    const diskPath = this.thumbDiskPath(assetId)
    if (existsSync(diskPath)) {
      try {
        const diskBuffer = readFileSync(diskPath)
        this.lruCache.set(assetId, diskBuffer)
        return diskBuffer
      } catch (err) {
        console.error(`[ThumbnailService] Failed to read disk thumb for ${assetId}:`, err)
        this.invalidate(assetId)
      }
    }

    const result = await this.generate(filePath, assetId)
    return result?.buffer ?? null
  }

  async getDataUrl(assetId: string, filePath: string, mimeType?: string): Promise<string | null> {
    const result = await this.generate(filePath, assetId)
    if (!result?.buffer?.length) return null
    if (result.usedOriginal && mimeType) {
      return bufferToImageDataUrl(result.buffer, mimeType)
    }
    return `data:image/webp;base64,${result.buffer.toString('base64')}`
  }

  invalidate(assetId: string): void {
    this.lruCache.delete(assetId)
    const diskPath = this.thumbDiskPath(assetId)
    try {
      if (existsSync(diskPath)) unlinkSync(diskPath)
    } catch (err) {
      console.error(`[ThumbnailService] Failed to unlink thumb ${diskPath}:`, err)
    }
  }

  /** Drop in-memory thumb only (keep disk file). */
  forgetMemoryCache(assetId: string): void {
    this.lruCache.delete(assetId)
  }

  clearAll(): void {
    this.lruCache.clear()
  }

  getStats(): { memoryEntries: number; memorySizeMB: number } {
    return {
      memoryEntries: this.lruCache.size,
      memorySizeMB: Math.round((this.lruCache.calculatedSize / 1024 / 1024) * 100) / 100
    }
  }

  cleanDiskCache(maxAgeMs: number = 1000 * 60 * 60 * 24 * 7): number {
    let cleaned = 0
    const now = Date.now()
    try {
      const files = readdirSync(this.thumbDirLegacy)
      for (const file of files) {
        if (!file.endsWith('.webp')) continue
        const fp = join(this.thumbDirLegacy, file)
        try {
          const stat = statSync(fp)
          if (now - stat.mtimeMs > maxAgeMs) {
            unlinkSync(fp)
            cleaned++
          }
        } catch (err) {
          console.warn(`[ThumbnailService] Skip stale entry in legacy thumb dir ${fp}:`, err)
        }
      }
    } catch (err) {
      console.warn(`[ThumbnailService] Failed to read legacy thumb dir:`, err)
    }

    cleaned += this.cleanLibraryItemThumbs(maxAgeMs)
    this.enforceLibraryThumbDiskBudget()
    return cleaned
  }

  /** Remove stale thumb.webp under library items/ (by mtime). */
  private cleanLibraryItemThumbs(maxAgeMs: number): number {
    if (!this.libraryRoot) return 0
    const itemsDir = join(this.libraryRoot, 'items')
    if (!existsSync(itemsDir)) return 0

    let cleaned = 0
    const now = Date.now()
    try {
      for (const entry of readdirSync(itemsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const thumbPath = join(itemsDir, entry.name, 'thumb.webp')
        if (!existsSync(thumbPath)) continue
        try {
          const stat = statSync(thumbPath)
          if (now - stat.mtimeMs > maxAgeMs) {
            unlinkSync(thumbPath)
            cleaned++
          }
        } catch (err) {
          console.warn(`[ThumbnailService] Skip stale entry in library item thumb ${thumbPath}:`, err)
        }
      }
    } catch (err) {
      console.warn(`[ThumbnailService] Failed to read library items dir:`, err)
    }
    return cleaned
  }

  /** Evict oldest library item thumbs when total disk cache exceeds maxDiskSize. */
  private enforceLibraryThumbDiskBudget(): void {
    if (!this.libraryRoot) return
    const itemsDir = join(this.libraryRoot, 'items')
    if (!existsSync(itemsDir)) return

    const maxBytes = this.maxDiskSize * 1024 * 1024
    const thumbs: Array<{ path: string; mtimeMs: number; size: number }> = []

    try {
      for (const entry of readdirSync(itemsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const thumbPath = join(itemsDir, entry.name, 'thumb.webp')
        if (!existsSync(thumbPath)) continue
        try {
          const stat = statSync(thumbPath)
          thumbs.push({ path: thumbPath, mtimeMs: stat.mtimeMs, size: stat.size })
        } catch (err) {
          console.warn(`[ThumbnailService] Skip stat for library item thumb ${thumbPath}:`, err)
        }
      }
    } catch (err) {
      console.warn(`[ThumbnailService] Failed to enumerate library items dir for budget:`, err)
      return
    }

    let total = thumbs.reduce((sum, t) => sum + t.size, 0)
    if (total <= maxBytes) return

    thumbs.sort((a, b) => a.mtimeMs - b.mtimeMs)
    for (const t of thumbs) {
      if (total <= maxBytes) break
      try {
        unlinkSync(t.path)
        total -= t.size
      } catch (err) {
        console.warn(`[ThumbnailService] Failed to evict thumb ${t.path} in budget:`, err)
      }
    }
  }
}

let instance: ThumbnailService | null = null

export function getThumbnailService(): ThumbnailService {
  if (!instance) {
    instance = new ThumbnailService()
  }
  return instance
}

function writeFileSafely(path: string, data: Buffer): void {
  const pathModule = require('path') as typeof import('path')
  const dirname_val = pathModule.dirname(path)
  if (!existsSync(dirname_val)) mkdirSync(dirname_val, { recursive: true })
  // Atomic write: write to temp file then rename, to avoid corrupting
  // the target file on power loss or crash mid-write.
  const tmpPath = path + '.tmp.' + Date.now()
  try {
    writeFileSync(tmpPath, data)
    renameSync(tmpPath, path)
  } catch (err) {
    // Clean up temp file on failure
    try { unlinkSync(tmpPath) } catch { /* best effort */ }
    throw err
  }
}
