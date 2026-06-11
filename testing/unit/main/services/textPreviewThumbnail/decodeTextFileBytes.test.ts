import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { decodeTextFileBytes, isValidUtf8 } from '@main/services/textPreviewThumbnail/decodeTextFileBytes'

describe('decodeTextFileBytes', () => {
  it('decodes UTF-8 with BOM', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('你好', 'utf8')])
    expect(decodeTextFileBytes(buf)).toBe('你好')
  })

  it('decodes UTF-8 Chinese', () => {
    expect(decodeTextFileBytes(Buffer.from('广东文化智算', 'utf8'))).toBe('广东文化智算')
  })

  it('falls back to GB18030 when UTF-8 is invalid', () => {
    // "广东" in GB2312 / GB18030
    const gb = Buffer.from([0xb9, 0xe3, 0xb6, 0xab])
    expect(decodeTextFileBytes(gb)).toBe('广东')
  })

  it('normalizes line endings and tabs', () => {
    expect(decodeTextFileBytes(Buffer.from('a\rb\tc', 'utf8'))).toBe('a\nb  c')
  })

  it('decodes GBK Windows .txt (testing/fixtures/3d-thumb-extractor/test/test.txt)', () => {
    const samplePath = join(process.cwd(), 'testing/fixtures/3d-thumb-extractor/test/test.txt')
    const head = readFileSync(samplePath).subarray(0, 256)
    const text = decodeTextFileBytes(head)
    expect(text.startsWith('广东文化智算中心平台')).toBe(true)
    expect(text).not.toMatch(/[\uFFFD]/)
  })
})

describe('isValidUtf8 boundary cases', () => {
  it('accepts valid ASCII', () => {
    expect(isValidUtf8(Buffer.from('hello', 'utf8'))).toBe(true)
  })

  it('accepts valid 2-byte sequence (U+00E9)', () => {
    expect(isValidUtf8(Buffer.from([0xc3, 0xa9]))).toBe(true) // é
  })

  it('accepts valid 3-byte CJK (U+4E16)', () => {
    expect(isValidUtf8(Buffer.from([0xe4, 0xb8, 0x96]))).toBe(true) // 世
  })

  it('accepts valid 4-byte emoji (U+1F600)', () => {
    expect(isValidUtf8(Buffer.from([0xf0, 0x9f, 0x98, 0x80]))).toBe(true) // 😀
  })

  it('rejects truncated 2-byte (missing continuation)', () => {
    expect(isValidUtf8(Buffer.from([0xc3]))).toBe(false)
  })

  it('rejects truncated 3-byte (only 1 continuation)', () => {
    expect(isValidUtf8(Buffer.from([0xe4, 0xb8]))).toBe(false)
  })

  it('rejects 0xC0 overlong (RFC 3629 prohibits)', () => {
    expect(isValidUtf8(Buffer.from([0xc0, 0x80]))).toBe(false)
  })

  it('rejects surrogate pair encoding (U+D800)', () => {
    expect(isValidUtf8(Buffer.from([0xed, 0xa0, 0x80]))).toBe(false)
  })

  it('rejects GBK bytes as UTF-8', () => {
    // "广东" in GBK = 0xB9E3 0xB6AB — neither is valid UTF-8 lead
    expect(isValidUtf8(Buffer.from([0xb9, 0xe3, 0xb6, 0xab]))).toBe(false)
  })

  it('rejects continuation byte as first byte', () => {
    expect(isValidUtf8(Buffer.from([0x80, 0x61]))).toBe(false)
  })

  it('accepts empty buffer', () => {
    expect(isValidUtf8(Buffer.alloc(0))).toBe(true)
  })
})
