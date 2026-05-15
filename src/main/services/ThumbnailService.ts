import { Transformer, ResizeFit } from '@napi-rs/image'
import { LRUCache } from 'lru-cache'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, unlinkSync, statSync, readdirSync, writeFileSync, readFileSync } from 'fs'
import { extractVideoFramePngBestEffort } from '../utils/videoFrame'
import { renderModelToPngBuffer } from './modelThumbnailRenderer'
import {
  isModelThumbnailSkipped,
  markModelThumbnailSkipped
} from './modelThumbnailSkip'
import { parseModel3dFormat } from '@/shared/model3dFormats'
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

  constructor(options?: { maxMemoryMB?: number; maxDiskMB?: number }) {
    this.maxMemorySize = options?.maxMemoryMB ?? 256 // 256MB memory cache
    this.maxDiskSize = options?.maxDiskMB ?? 2048 // 2GB disk cache
    this.thumbDirLegacy = join(app.getPath('userData'), 'thumbnails')

    if (!existsSync(this.thumbDirLegacy)) {
      mkdirSync(this.thumbDirLegacy, { recursive: true })
    }

    this.lruCache = new LRUCache<string, Buffer>({
      maxSize: this.maxMemorySize * 1024 * 1024,
      sizeCalculation: (value) => value.length,
      ttl: 1000 * 60 * 30 // 30 min TTL for memory
    })

    console.log(
      `[ThumbnailService] Initialized - Memory: ${this.maxMemorySize}MB, legacy dir: ${this.thumbDirLegacy}`
    )
  }

  /** When set, new thumbnails are written to {libraryRoot}/items/{assetId}/thumb.webp */
  setLibraryRoot(root: string | null): void {
    this.libraryRoot = root ? root : null
    console.log(`[ThumbnailService] Library root: ${this.libraryRoot ?? '(legacy userData thumbs only)'}`)
  }

  private thumbDiskPath(assetId: string): string {
    if (this.libraryRoot) {
      const dir = join(this.libraryRoot, 'items', assetId)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      return join(dir, 'thumb.webp')
    }
    return join(this.thumbDirLegacy, `${assetId}.webp`)
  }

  /**
   * Generate thumbnail for an image file using @napi-rs/image
   */
  async generate(
    filePath: string,
    assetId: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    const maxEdge = options.width ?? THUMBNAIL_MAX_EDGE
    const { height = maxEdge, quality = 80 } = options

    try {
      const fileBuffer = readFileSync(filePath)
      const transformer = new Transformer(fileBuffer)
      const imgInfo = await transformer.metadata()

      if (shouldUseOriginalImageDimensions(imgInfo.width, imgInfo.height)) {
        this.lruCache.set(assetId, fileBuffer)
        return { buffer: fileBuffer, path: filePath, usedOriginal: true }
      }

      const outputPath = this.thumbDiskPath(assetId)
      if (existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      const webpBuffer = await transformer
        .resize(maxEdge, height, undefined, ResizeFit.Inside)
        .webp(quality)

      writeFileSafely(outputPath, webpBuffer as Buffer)
      this.lruCache.set(assetId, webpBuffer as Buffer)

      return { buffer: webpBuffer as Buffer, path: outputPath }
    } catch (error) {
      console.error(`[ThumbnailService] Failed to generate thumbnail for ${filePath}:`, error)
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
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    const maxEdge = options.width ?? THUMBNAIL_MAX_EDGE
    const { height = maxEdge, quality = 80 } = options
    const outputPath = this.thumbDiskPath(assetId)

    if (!parseModel3dFormat(ext)) {
      console.warn(`[ThumbnailService] Unsupported 3D extension: ${ext}`)
      return null
    }

    if (isModelThumbnailSkipped(assetId)) {
      return null
    }

    try {
      if (existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      const png = await renderModelToPngBuffer(filePath, ext)
      if (!png?.length) {
        markModelThumbnailSkipped(assetId)
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
      markModelThumbnailSkipped(assetId)
      console.warn(`[ThumbnailService] 3D thumbnail skipped for ${filePath}:`, error)
      return null
    }
  }

  async generateVideo(
    filePath: string,
    assetId: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<ThumbnailGenerateResult | null> {
    const maxEdge = options.width ?? THUMBNAIL_MAX_EDGE
    const { height = maxEdge, quality = 80 } = options
    const outputPath = this.thumbDiskPath(assetId)

    try {
      if (existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      const png = await extractVideoFramePngBestEffort(filePath)
      if (!png) return null

      const transformer = new Transformer(png)
      const frameInfo = await transformer.metadata()
      const webpBuffer = shouldUseOriginalImageDimensions(frameInfo.width, frameInfo.height)
        ? await transformer.webp(quality)
        : await transformer.resize(maxEdge, height, undefined, ResizeFit.Inside).webp(quality)

      writeFileSafely(outputPath, webpBuffer as Buffer)
      this.lruCache.set(assetId, webpBuffer as Buffer)

      return { buffer: webpBuffer as Buffer, path: outputPath }
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
      } catch {
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
    } catch {
      // ignore
    }
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
        } catch {
          // skip
        }
      }
    } catch {
      // dir not readable
    }
    return cleaned
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
  const dirname_val = require('path').dirname(path)
  if (!existsSync(dirname_val)) mkdirSync(dirname_val, { recursive: true })
  writeFileSync(path, data)
}
