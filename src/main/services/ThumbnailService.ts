import { Transformer, ResizeFit } from '@napi-rs/image'
import { LRUCache } from 'lru-cache'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, unlinkSync, statSync, readdirSync, writeFileSync, readFileSync } from 'fs'
import { extractVideoFramePngBestEffort } from '../utils/videoFrame'

/**
 * Three-level Thumbnail Cache System
 * Level 1: In-memory LRU cache (fastest, ~1000 entries)
 * Level 2: Disk cache (webp files in userData/thumbnails)
 * Level 3: Database (thumbnail_path reference)
 *
 * Uses @napi-rs/image (Rust-based, prebuilt binaries) instead of sharp
 */
export class ThumbnailService {
  private lruCache: LRUCache<string, Buffer>
  private thumbDir: string
  private maxMemorySize: number // MB
  private maxDiskSize: number // MB

  constructor(options?: { maxMemoryMB?: number; maxDiskMB?: number }) {
    this.maxMemorySize = options?.maxMemoryMB ?? 256 // 256MB memory cache
    this.maxDiskSize = options?.maxDiskMB ?? 2048 // 2GB disk cache
    this.thumbDir = join(app.getPath('userData'), 'thumbnails')

    if (!existsSync(this.thumbDir)) {
      mkdirSync(this.thumbDir, { recursive: true })
    }

    this.lruCache = new LRUCache<string, Buffer>({
      maxSize: this.maxMemorySize * 1024 * 1024,
      sizeCalculation: (value) => value.length,
      ttl: 1000 * 60 * 30 // 30 min TTL for memory
    })

    console.log(`[ThumbnailService] Initialized - Memory: ${this.maxMemorySize}MB, Disk: ${this.thumbDir}`)
  }

  /**
   * Generate thumbnail for an image file using @napi-rs/image
   * Returns webp buffer at target size
   */
  async generate(
    filePath: string,
    assetId: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<{ buffer: Buffer; path: string } | null> {
    const { width = 256, height = 256, quality = 80 } = options

    try {
      const outputPath = join(this.thumbDir, `${assetId}.webp`)

      // Check if already cached on disk
      if (existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      // Load and process image with @napi-rs/image
      const fileBuffer = readFileSync(filePath)
      const transformer = new Transformer(fileBuffer)

      // Resize with inside fit
      const webpBuffer = await transformer.resize(width, height, undefined, ResizeFit.Inside).webp(quality)

      // Save to disk (Level 2)
      writeFileSafely(outputPath, webpBuffer)

      // Store in memory (Level 1)
      this.lruCache.set(assetId, webpBuffer as Buffer)

      return { buffer: webpBuffer as Buffer, path: outputPath }
    } catch (error) {
      console.error(`[ThumbnailService] Failed to generate thumbnail for ${filePath}:`, error)
      return null
    }
  }

  /**
   * Generate a WebP thumbnail from a video file (ffmpeg frame → @napi-rs/image).
   */
  async generateVideo(
    filePath: string,
    assetId: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<{ buffer: Buffer; path: string } | null> {
    const { width = 256, height = 256, quality = 80 } = options

    try {
      const outputPath = join(this.thumbDir, `${assetId}.webp`)

      if (existsSync(outputPath)) {
        const diskBuffer = readFileSync(outputPath)
        this.lruCache.set(assetId, diskBuffer)
        return { buffer: diskBuffer, path: outputPath }
      }

      const png = await extractVideoFramePngBestEffort(filePath)
      if (!png) return null

      const transformer = new Transformer(png)
      const webpBuffer = await transformer.resize(width, height, undefined, ResizeFit.Inside).webp(quality)

      writeFileSafely(outputPath, webpBuffer as Buffer)
      this.lruCache.set(assetId, webpBuffer as Buffer)

      return { buffer: webpBuffer as Buffer, path: outputPath }
    } catch (error) {
      console.error(`[ThumbnailService] Failed to generate video thumbnail for ${filePath}:`, error)
      return null
    }
  }

  /**
   * Get thumbnail from cache hierarchy:
   * 1. Memory LRU -> 2. Disk -> 3. Regenerate
   */
  async get(assetId: string, filePath: string): Promise<Buffer | null> {
    // Level 1: Memory cache
    const memCached = this.lruCache.get(assetId)
    if (memCached) return memCached

    // Level 2: Disk cache
    const diskPath = join(this.thumbDir, `${assetId}.webp`)
    if (existsSync(diskPath)) {
      try {
        const diskBuffer = readFileSync(diskPath)
        this.lruCache.set(assetId, diskBuffer) // Promote to L1
        return diskBuffer
      } catch {
        // Corrupted file, regenerate
        this.invalidate(assetId)
      }
    }

    // Level 3: Regenerate
    const result = await this.generate(filePath, assetId)
    return result?.buffer ?? null
  }

  /**
   * Get thumbnail as base64 data URL for IPC transfer
   */
  async getDataUrl(assetId: string, filePath: string): Promise<string | null> {
    const buffer = await this.get(assetId, filePath)
    if (!buffer) return null
    return `data:image/webp;base64,${buffer.toString('base64')}`
  }

  /**
   * Invalidate a single thumbnail from all cache levels
   */
  invalidate(assetId: string): void {
    this.lruCache.delete(assetId)
    const diskPath = join(this.thumbDir, `${assetId}.webp`)
    try {
      if (existsSync(diskPath)) unlinkSync(diskPath)
    } catch {
      // ignore
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.lruCache.clear()
    // Note: Don't delete disk files here, they persist across sessions
  }

  /**
   * Get cache statistics
   */
  getStats(): { memoryEntries: number; memorySizeMB: number } {
    return {
      memoryEntries: this.lruCache.size,
      memorySizeMB: Math.round((this.lruCache.calculatedSize / 1024 / 1024) * 100) / 100
    }
  }

  /**
   * Clean up old disk cache entries (call periodically)
   */
  cleanDiskCache(maxAgeMs: number = 1000 * 60 * 60 * 24 * 7): number {
    // Remove files older than 7 days by default
    let cleaned = 0
    const now = Date.now()
    try {
      const files = readdirSync(this.thumbDir)
      for (const file of files) {
        if (!file.endsWith('.webp')) continue
        const filePath = join(this.thumbDir, file)
        try {
          const stat = statSync(filePath)
          if (now - stat.mtimeMs > maxAgeMs) {
            unlinkSync(filePath)
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

// Singleton instance
let instance: ThumbnailService | null = null

export function getThumbnailService(): ThumbnailService {
  if (!instance) {
    instance = new ThumbnailService()
  }
  return instance
}

// Helper: atomic write
function writeFileSafely(path: string, data: Buffer): void {
  const dirname_val = require('path').dirname(path)
  if (!existsSync(dirname_val)) mkdirSync(dirname_val, { recursive: true })
  writeFileSync(path, data)
}
