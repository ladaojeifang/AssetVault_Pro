const path = require('path');
const zlib = require('zlib');
const { fsp } = require('../util/fs');
const { rgbaToBmp } = require('../util/bmp');
const { isGzip, isBlendHeader } = require('../util/magic');

async function gunzipMaybe(filePath) {
  const raw = await fsp.readFile(filePath);
  if (isGzip(raw)) return zlib.gunzipSync(raw);
  return raw;
}

function parseBlendTestBlock(data) {
  if (!isBlendHeader(data)) return { ok: false, error: 'not-blend' };
  const pointerSize = data[7] === 0x2d ? 8 : 4;
  const little = data[8] === 0x76;
  const i32 = (off) => little ? data.readInt32LE(off) : data.readInt32BE(off);
  let offset = 12;

  while (offset + 8 <= data.length) {
    const code = data.subarray(offset, offset + 4).toString('ascii');
    if (code === 'ENDB') break;
    const size = i32(offset + 4);
    const headerSize = 16 + pointerSize;
    const bodyStart = offset + headerSize;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > data.length) break;

    if (code === 'TEST') {
      const raw = data.subarray(bodyStart, bodyEnd);
      const w = little ? raw.readInt32LE(0) : raw.readInt32BE(0);
      const h = little ? raw.readInt32LE(4) : raw.readInt32BE(4);
      const rgba = raw.subarray(8);
      if (w > 0 && h > 0 && rgba.length >= w * h * 4) {
        return { ok: true, width: w, height: h, rgba: rgba.subarray(0, w * h * 4) };
      }
    }
    offset = bodyEnd;
  }
  return { ok: false, error: 'test-block-not-found' };
}

function rgbaToBGRA(rgba) {
  const out = Buffer.alloc(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    out[i] = rgba[i + 2];
    out[i + 1] = rgba[i + 1];
    out[i + 2] = rgba[i];
    out[i + 3] = rgba[i + 3];
  }
  return out;
}

async function extractBlend(filePath, outDir) {
  const data = await gunzipMaybe(filePath);
  const parsed = parseBlendTestBlock(data);
  const outPath = path.join(outDir, path.basename(filePath) + '.bmp');

  if (!parsed.ok) return { ok: false, format: 'blend', error: parsed.error };
  const bgra = rgbaToBGRA(parsed.rgba);
  const bmp = rgbaToBmp(parsed.width, parsed.height, bgra);
  await fsp.writeFile(outPath, bmp);
  return { ok: true, format: 'blend', type: 'bmp', outPath, width: parsed.width, height: parsed.height };
}

module.exports = { extractBlend };