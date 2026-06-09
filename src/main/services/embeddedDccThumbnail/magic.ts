export function isC4DHeader(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).toString('ascii') === 'QC4DC4D6'
}

const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

export function isOle(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(OLE_MAGIC)
}

export function isGzip(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0x1f && buf[1] === 0x8b && buf[2] === 0x08
}

export function isBlendHeader(buf: Buffer): boolean {
  return buf.length >= 7 && buf.subarray(0, 7).toString('ascii') === 'BLENDER'
}

export function isHipHeader(buf: Buffer): boolean {
  return buf.length >= 6 && buf.subarray(0, 6).toString('ascii') === '070707'
}
