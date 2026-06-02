/**
 * Supported import extensions (leading dot, lowercase) — aligned with PRD format matrix.
 */

import { MODEL3D_ALL_EXTENSIONS } from './model3dFormats'

export const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.tiff',
  '.tif',
  '.exr',
  '.heic',
  '.heif',
  '.avif',
  '.cr2',
  '.nef',
  '.arw',
  '.orf',
  '.raf',
  '.dng',
  '.rw2',
  '.raw'
])

export const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.flv',
  '.wmv',
  '.m4v',
  '.3gp',
  '.mpeg',
  '.mpg',
  '.m2ts',
  '.mts'
])

export const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.flac',
  '.aac',
  '.ogg',
  '.oga',
  '.wma',
  '.m4a',
  '.aiff',
  '.aif',
  '.ape',
  '.opus'
])

export const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2', '.eot', '.ttc'])

/** PSD, AI, Sketch, Figma, XD, PDF, EPS */
export const DESIGN_EXTENSIONS = new Set([
  '.psd',
  '.ai',
  '.sketch',
  '.fig',
  '.xd',
  '.pdf',
  '.eps',
  '.indd',
  '.afdesign'
])

/** Office + text tabular (PDF is under design per PRD) */
export const DOCUMENT_EXTENSIONS = new Set([
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.md',
  '.txt',
  '.csv',
  '.rtf',
  '.odt',
  '.ods',
  '.odp'
])

/** 3D asset extensions (preview-capable + import-only). See `model3dFormats.ts`. */
export const THREED_EXTENSIONS: ReadonlySet<string> = MODEL3D_ALL_EXTENSIONS

/** PRD code row + common companions for same workflow */
export const CODE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.json',
  '.yaml',
  '.yml',
  '.vue',
  '.svelte',
  '.rs',
  '.go',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.php',
  '.rb',
  '.sh',
  '.ps1',
  '.bat',
  '.cmd',
  '.xml'
])

const _all = new Set<string>()
for (const s of [
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  FONT_EXTENSIONS,
  DESIGN_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  THREED_EXTENSIONS,
  CODE_EXTENSIONS
]) {
  for (const e of s) _all.add(e)
}

/** Every extension we allow when scanning folders / file dialog “all supported”. */
export const ALL_SUPPORTED_IMPORT_EXTENSIONS: ReadonlySet<string> = _all

/** Electron `showOpenDialog` expects extensions **without** the dot. */
export function supportedExtensionsForDialog(): string[] {
  return [...ALL_SUPPORTED_IMPORT_EXTENSIONS].map((e) => e.slice(1))
}
