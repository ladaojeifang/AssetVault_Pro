const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function walkFiles(inputPath) {
  const out = [];
  const st = await fsp.stat(inputPath);
  if (st.isFile()) return [inputPath];

  const stack = [inputPath];
  while (stack.length) {
    const cur = stack.pop();
    const entries = await fsp.readdir(cur, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) out.push(p);
    }
  }
  return out;
}

async function readHead(filePath, bytes = 256) {
  const fh = await fsp.open(filePath, 'r');
  try {
    const stat = await fh.stat();
    const size = Math.min(bytes, stat.size);
    const buf = Buffer.alloc(size);
    await fh.read(buf, 0, size, 0);
    return buf;
  } finally {
    await fh.close();
  }
}

async function fileSize(filePath) {
  const stat = await fsp.stat(filePath);
  return stat.size;
}

function sanitizeBaseName(filePath) {
  return path.basename(filePath).replace(/[\\/:*?"<>|]/g, '_');
}

module.exports = {
  fs,
  fsp,
  exists,
  ensureDir,
  walkFiles,
  readHead,
  fileSize,
  sanitizeBaseName,
};