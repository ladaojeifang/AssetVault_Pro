/** Uint8Array → BlobPart for strict DOM lib (ArrayBufferLike vs ArrayBuffer). */
export function toBlobPart(bytes: Uint8Array): BlobPart {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}
