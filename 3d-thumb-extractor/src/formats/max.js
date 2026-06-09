const path = require('path');
const { fsp } = require('../util/fs');
const { wrapDibToBmp } = require('../util/bmp');

function parseDibCandidates(buf) {
  const sig = Buffer.from([0x28, 0x00, 0x00, 0x00]);
  const out = [];
  let idx = buf.indexOf(sig);
  while (idx !== -1) {
    if (idx + 40 <= buf.length) {
      const width = buf.readInt32LE(idx + 4);
      const height = buf.readInt32LE(idx + 8);
      const planes = buf.readUInt16LE(idx + 12);
      const bpp = buf.readUInt16LE(idx + 14);
      if (width >= 16 && width <= 4096 &&
          height >= 16 && height <= 4096 &&
          planes === 1 &&
          (bpp === 24 || bpp === 32)) {
        out.push({ offset: idx, width, height, bpp });
      }
    }
    idx = buf.indexOf(sig, idx + 4);
  }
  return out;
}

function pickBest(candidates) {
  if (!candidates.length) return null;
  return candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
}

async function extractMax(filePath, outDir) {
  const data = await fsp.readFile(filePath);
  const candidates = parseDibCandidates(data);
  const best = pickBest(candidates);
  const outPath = path.join(outDir, path.basename(filePath) + '.bmp');

  if (!best) return { ok: false, format: 'max', error: 'dib-not-found' };

  const rowSize = Math.floor((best.width * best.bpp + 31) / 32) * 4;
  const pixelBytes = rowSize * best.height;
  const dibSize = 40 + pixelBytes;
  if (best.offset + dibSize > data.length) {
    return { ok: false, format: 'max', error: 'dib-out-of-range' };
  }
  const dib = data.subarray(best.offset, best.offset + dibSize);
  const bmp = wrapDibToBmp(dib);
  await fsp.writeFile(outPath, bmp);
  return { ok: true, format: 'max', type: 'bmp', outPath, width: best.width, height: best.height };
}

module.exports = { extractMax };