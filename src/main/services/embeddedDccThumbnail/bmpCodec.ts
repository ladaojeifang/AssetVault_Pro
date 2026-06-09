export function rgbaToBmp(width: number, height: number, pixelBuffer: Buffer): Buffer {
  const fileHeaderSize = 14
  const dibHeaderSize = 40
  const pixelDataOffset = fileHeaderSize + dibHeaderSize
  const pixelDataSize = width * height * 4
  const fileSize = pixelDataOffset + pixelDataSize

  const header = Buffer.alloc(pixelDataOffset)
  header.write('BM', 0)
  header.writeUInt32LE(fileSize, 2)
  header.writeUInt32LE(0, 6)
  header.writeUInt32LE(pixelDataOffset, 10)
  header.writeUInt32LE(dibHeaderSize, 14)
  header.writeInt32LE(width, 18)
  header.writeInt32LE(height, 22)
  header.writeUInt16LE(1, 26)
  header.writeUInt16LE(32, 28)
  header.writeUInt32LE(0, 30)
  header.writeUInt32LE(pixelDataSize, 34)
  header.writeInt32LE(2835, 38)
  header.writeInt32LE(2835, 42)
  header.writeUInt32LE(0, 46)
  header.writeUInt32LE(0, 50)

  return Buffer.concat([header, pixelBuffer])
}

export function wrapDibToBmp(dibBuffer: Buffer): Buffer {
  const fileHeader = Buffer.alloc(14)
  fileHeader.write('BM', 0)
  fileHeader.writeUInt32LE(14 + dibBuffer.length, 2)
  fileHeader.writeUInt32LE(0, 6)
  fileHeader.writeUInt32LE(54, 10)
  return Buffer.concat([fileHeader, dibBuffer])
}

export function rgbaToBGRA(rgbaBuffer: Buffer): Buffer {
  const out = Buffer.alloc(rgbaBuffer.length)
  for (let i = 0; i < rgbaBuffer.length; i += 4) {
    out[i] = rgbaBuffer[i + 2]
    out[i + 1] = rgbaBuffer[i + 1]
    out[i + 2] = rgbaBuffer[i]
    out[i + 3] = rgbaBuffer[i + 3]
  }
  return out
}
