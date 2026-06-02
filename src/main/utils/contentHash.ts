import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

const YIELD_EVERY_BYTES = 4 * 1024 * 1024

/** Stream-compute SHA-256 hex digest for a file on disk. Yields to the event loop periodically. */
export function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath, { highWaterMark: 256 * 1024 })
    let bytesSinceYield = 0

    stream.on('data', (chunk: Buffer) => {
      hash.update(chunk)
      bytesSinceYield += chunk.length
      if (bytesSinceYield >= YIELD_EVERY_BYTES) {
        bytesSinceYield = 0
        stream.pause()
        setImmediate(() => stream.resume())
      }
    })
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}
