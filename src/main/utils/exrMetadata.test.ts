import { describe, expect, it, vi } from 'vitest'
import { EXR_DEFAULT_LAYER_NAME } from '@/shared/exrTypes'
import {
  EXR_FLAG_MULTIPART,
  EXR_MAGIC,
  parseExrMetadataFromBuffer,
  readExrVersionFlags
} from './exrMetadata'

vi.mock('fs', () => ({
  statSync: vi.fn(() => ({ size: 1024 })),
  readFileSync: vi.fn(() => Buffer.alloc(8)),
  openSync: vi.fn(),
  closeSync: vi.fn(),
  readSync: vi.fn()
}))

vi.mock('@napi-rs/image', () => ({
  Transformer: vi.fn().mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080, format: 'exr', colorType: 0 })
  }))
}))

function buildMinimalExrHeaderBuffer(versionFlags = 0): Buffer {
  const parts: Buffer[] = []
  const magic = Buffer.alloc(4)
  magic.writeUInt32LE(EXR_MAGIC, 0)
  const ver = Buffer.alloc(4)
  ver.writeUInt32LE(versionFlags, 0)
  parts.push(magic, ver)

  parts.push(Buffer.from('dataWindow\0', 'ascii'))
  parts.push(Buffer.from('box2i\0', 'ascii'))
  const dwSize = Buffer.alloc(4)
  dwSize.writeUInt32LE(16, 0)
  parts.push(dwSize)
  const dwVal = Buffer.alloc(16)
  dwVal.writeInt32LE(0, 0)
  dwVal.writeInt32LE(0, 4)
  dwVal.writeInt32LE(63, 8)
  dwVal.writeInt32LE(63, 12)
  parts.push(dwVal)

  parts.push(Buffer.from('channels\0', 'ascii'))
  parts.push(Buffer.from('chlist\0', 'ascii'))
  const chMeta = Buffer.alloc(16)
  chMeta.writeInt32LE(2, 0)
  const chlistVal = Buffer.concat([
    Buffer.from('R\0', 'ascii'),
    chMeta,
    Buffer.from('G\0', 'ascii'),
    chMeta,
    Buffer.from('B\0', 'ascii'),
    chMeta,
    Buffer.from('A\0', 'ascii'),
    chMeta,
    Buffer.from([0])
  ])
  const chSize = Buffer.alloc(4)
  chSize.writeUInt32LE(chlistVal.length, 0)
  parts.push(chSize, chlistVal)

  parts.push(Buffer.from([0]))
  return Buffer.concat(parts)
}

describe('readExrVersionFlags', () => {
  it('detects multipart flag in version dword', () => {
    const buf = Buffer.alloc(8)
    buf.writeUInt32LE(EXR_MAGIC, 0)
    buf.writeUInt32LE(EXR_FLAG_MULTIPART, 4)
    expect(readExrVersionFlags(buf).multipart).toBe(true)
    expect(readExrVersionFlags(buf).longNames).toBe(false)
  })
})

describe('parseExrMetadataFromBuffer multipart', () => {
  it('marks layer list incomplete when multipart flag is set', () => {
    const buf = buildMinimalExrHeaderBuffer(EXR_FLAG_MULTIPART)
    const meta = parseExrMetadataFromBuffer(buf, '/fake/multipart.exr')
    expect(meta).not.toBeNull()
    expect(meta?.layerListIncomplete).toBe(true)
    expect(meta?.perLayerPreviewAvailable).toBe(false)
    expect(meta?.defaultLayerName).toBe(EXR_DEFAULT_LAYER_NAME)
  })

  it('parses standard RGBA layers when not multipart', () => {
    const buf = buildMinimalExrHeaderBuffer(0)
    const meta = parseExrMetadataFromBuffer(buf, '/fake/rgba.exr')
    expect(meta?.layerListIncomplete).toBe(false)
    expect(meta?.layers[0]?.name).toBe(EXR_DEFAULT_LAYER_NAME)
    expect(meta?.perLayerPreviewAvailable).toBe(true)
  })
})

describe('resolveExrFileMetadata napi-only', () => {
  it('marks layer list incomplete when header read fails', async () => {
    const mod = await import('@/main/utils/exrMetadata')
    vi.spyOn(mod, 'readExrHeaderBuffer').mockImplementation(() => {
      throw new Error('header unreadable')
    })

    const meta = await mod.resolveExrFileMetadata('/fake/multi-layer.exr')
    expect(meta).not.toBeNull()
    expect(meta?.layerListIncomplete).toBe(true)
    expect(meta?.perLayerPreviewAvailable).toBe(false)
    expect(meta?.channelControlAvailable).toBe(false)
    expect(meta?.layers).toHaveLength(1)
    expect(meta?.layers[0]?.previewable).toBe(false)
    expect(meta?.defaultLayerName).toBe(EXR_DEFAULT_LAYER_NAME)
    expect(meta?.probeSource).toBe('napi')
  })
})
