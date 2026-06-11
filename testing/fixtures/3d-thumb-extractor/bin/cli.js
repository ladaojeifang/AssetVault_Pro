#!/usr/bin/env node
'use strict';

const path = require('path');
const { extractFile, extractFolder, exists } = require('../src');

(async () => {
  const [input, out] = process.argv.slice(2);
  if (!input) {
    console.error('Usage: 3dthumb <input-file-or-folder> [output-folder]');
    process.exit(1);
  }
  if (!await exists(input)) {
    console.error('Input not found:', input);
    process.exit(1);
  }
  const outDir = out || path.join(process.cwd(), 'thumbnails_output');

  const isDir = (await require('../src/util/fs').fsp.stat(input)).isDirectory();
  if (isDir) {
    const res = await extractFolder(input, outDir);
    res.forEach(r => {
      console.log(`[${r.ok ? 'OK' : 'FAIL'}] ${r.format} ${r.file || ''} ${r.outPath || ''} ${r.error ? '(' + r.error + ')' : ''}`);
    });
  } else {
    const r = await extractFile(input, outDir);
    console.log(`[${r.ok ? 'OK' : 'FAIL'}] ${r.format} ${input} ${r.outPath || ''} ${r.error ? '(' + r.error + ')' : ''}`);
  }
})();