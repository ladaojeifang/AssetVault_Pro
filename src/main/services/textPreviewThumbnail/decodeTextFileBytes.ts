/** Decode text file bytes with BOM + UTF-8 / GB18030 fallback (Node 24+ has no Buffer gb18030). */

export function decodeTextFileBytes(buf: Buffer): string {
  let bytes = buf

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return normalizeText(bytes.subarray(3).toString('utf8'))
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return normalizeText(bytes.subarray(2).toString('utf16le'))
  }

  if (isValidUtf8(bytes)) {
    return normalizeText(bytes.toString('utf8'))
  }

  const gb = decodeWithTextDecoder(bytes, 'gb18030')
  if (gb !== null) {
    return normalizeText(gb)
  }

  return normalizeText(bytes.toString('utf8'))
}

/** Pure JS UTF-8 scan — avoids TextDecoder fatal on large GBK buffers (Electron hard-crash on Windows). */
export function isValidUtf8(buf: Buffer): boolean {
  let i = 0
  while (i < buf.length) {
    const b = buf[i]!
    if (b <= 0x7f) {
      i++
      continue
    }
    if (b >= 0xc2 && b <= 0xdf) {
      if (i + 1 >= buf.length || (buf[i + 1]! & 0xc0) !== 0x80) return false
      i += 2
      continue
    }
    if (b >= 0xe0 && b <= 0xef) {
      if (i + 2 >= buf.length) return false
      const b1 = buf[i + 1]!
      const b2 = buf[i + 2]!
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) return false
      if (b === 0xe0 && b1 < 0xa0) return false
      if (b === 0xed && b1 >= 0xa0) return false
      i += 3
      continue
    }
    if (b >= 0xf0 && b <= 0xf4) {
      if (i + 3 >= buf.length) return false
      const b1 = buf[i + 1]!
      const b2 = buf[i + 2]!
      const b3 = buf[i + 3]!
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) return false
      if (b === 0xf0 && b1 < 0x90) return false
      if (b === 0xf4 && b1 >= 0x90) return false
      i += 4
      continue
    }
    return false
  }
  return true
}

function decodeWithTextDecoder(bytes: Buffer, encoding: string): string | null {
  try {
    return new TextDecoder(encoding).decode(bytes)
  } catch {
    return null
  }
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
}
