const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd'])

export function isMarkdownExtension(extension: string): boolean {
  const ext = extension.replace(/^\./, '').toLowerCase().trim()
  return MARKDOWN_EXTENSIONS.has(ext)
}
