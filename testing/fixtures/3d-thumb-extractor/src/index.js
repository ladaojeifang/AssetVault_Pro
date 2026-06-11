const path = require('path');
const { exists, ensureDir, walkFiles, readHead } = require('./util/fs');
const { isC4DHeader, isOle, isGzip, isBlendHeader, isHipHeader } = require('./util/magic');
const { extractC4D } = require('./formats/c4d');
const { extractMax } = require('./formats/max');
const { extractBlend } = require('./formats/blend');
const { extractTextLike } = require('./formats/text'); // 你实现即可

function extOf(file) {
  return path.extname(file).toLowerCase();
}

async function extractFile(filePath, outDir) {
  const head = await readHead(filePath, 64);
  const ext = extOf(filePath);

  if (ext === '.c4d' || isC4DHeader(head)) {
    return extractC4D(filePath, outDir);
  }
  if (ext === '.max' || isOle(head)) {
    return extractMax(filePath, outDir);
  }
  if (ext === '.blend' || isGzip(head) || isBlendHeader(head)) {
    return extractBlend(filePath, outDir);
  }
  if (ext === '.txt' || ext === '.json' || ext === '.md') {
    return extractTextLike(filePath, outDir);
  }
  if (ext === '.hip' || isHipHeader(head)) {
    return { ok: false, format: 'hip', error: 'hip-has-no-embedded-thumbnail-by-default' };
  }

  return { ok: false, format: 'unknown', error: 'unsupported-format' };
}

async function extractFolder(inputPath, outDir) {
  await ensureDir(outDir);
  const files = await walkFiles(inputPath);
  const results = [];
  for (const file of files) {
    await extractTextLike(filePath, outDir, {
	  width: 256,
	  height: 256,
	  maxLines: 16,
	  maxCols: 28
	});
    results.push(res);
  }
  return results;
}

module.exports = { extractFile, extractFolder, exists };