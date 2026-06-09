const path = require('path');
const { fsp } = require('../util/fs');

const DEFAULT = { chunkSize: 1024 * 1024, overlap: 64 };

async function extractC4D(filePath, outDir, opts = {}) {
  const { chunkSize, overlap } = { ...DEFAULT, ...opts };
  const fh = await fsp.open(filePath, 'r');
  const outPath = path.join(outDir, path.basename(filePath) + '.jpg');
  const startPattern = Buffer.from([0xFF, 0xD8, 0xFF]);
  const endPattern = Buffer.from([0xFF, 0xD9]);

  try {
    const stat = await fh.stat();
    let offset = 0;
    let previousTail = Buffer.alloc(0);
    let recording = false;
    const chunks = [];

    while (offset < stat.size) {
      const toRead = Math.min(chunkSize, stat.size - offset);
      const buf = Buffer.alloc(toRead);
      const { bytesRead } = await fh.read(buf, 0, toRead, offset);
      if (!bytesRead) break;
      const chunk = bytesRead === buf.length ? buf : buf.subarray(0, bytesRead);
      const window = previousTail.length ? Buffer.concat([previousTail, chunk]) : chunk;

      if (!recording) {
        const startIdx = window.indexOf(startPattern);
        if (startIdx !== -1) {
          const endIdx = window.indexOf(endPattern, startIdx + 3);
          if (endIdx !== -1) {
            const jpg = window.subarray(startIdx, endIdx + 2);
            await fsp.writeFile(outPath, jpg);
            return { ok: true, format: 'c4d', type: 'jpg', outPath, note: 'single-window' };
          }
          recording = true;
          chunks.push(window.subarray(startIdx));
        }
      } else {
        const endIdx = window.indexOf(endPattern);
        if (endIdx !== -1) {
          const adjusted = endIdx - previousTail.length;
          if (adjusted >= 0) chunks.push(chunk.subarray(0, adjusted + 2));
          const jpg = Buffer.concat(chunks);
          await fsp.writeFile(outPath, jpg);
          return { ok: true, format: 'c4d', type: 'jpg', outPath, note: 'multi-window' };
        }
        chunks.push(chunk);
      }

      previousTail = chunk.subarray(Math.max(0, chunk.length - overlap));
      offset += bytesRead;
    }

    return { ok: false, format: 'c4d', error: 'jpeg-not-found' };
  } finally {
    await fh.close();
  }
}

module.exports = { extractC4D };