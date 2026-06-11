import { useEffect, useState } from 'react'
import type { AssetItem } from '@/shared/types'
import { toBlobPart } from '@/shared/blobUtils'
import { fontPreviewFamilyName } from '../utils/fontAssetMeta'
import { resolveLibraryFileProtocolUrl } from '../utils/appFileProtocolUrl'
import { i18n } from '../i18n'

const MIME_BY_EXT: Record<string, string> = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttc: 'font/collection',
  eot: 'application/vnd.ms-fontobject'
}

const FORMAT_BY_EXT: Record<string, string> = {
  ttf: 'truetype',
  otf: 'opentype',
  woff: 'woff',
  woff2: 'woff2',
  ttc: 'collection',
  eot: 'embedded-opentype'
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function fontFaceSourceUrl(url: string, extension: string): string {
  const format = FORMAT_BY_EXT[extension]
  return format ? `url(${url}) format('${format}')` : `url(${url})`
}

async function loadFontFaceFromBytes(
  familyName: string,
  storedPath: string,
  extension: string
): Promise<FontFace> {
  const bytes = await window.assetVaultAPI.fs.readFileBytes(storedPath)
  const mime = MIME_BY_EXT[extension] ?? 'application/octet-stream'
  const blob = new Blob([toBlobPart(bytes)], { type: mime })
  const blobUrl = URL.createObjectURL(blob)
  try {
    const face = new FontFace(familyName, fontFaceSourceUrl(blobUrl, extension))
    await face.load()
    return face
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

async function loadFontFaceForAsset(asset: AssetItem, familyName: string): Promise<FontFace> {
  const target = asset.resolvedFilePath ?? asset.filePath
  const ext = fileExtension(asset.filename || target)

  try {
    const href = await resolveLibraryFileProtocolUrl(target)
    const face = new FontFace(familyName, fontFaceSourceUrl(href, ext))
    await face.load()
    return face
  } catch (protocolErr) {
    console.warn('[Font] protocol load failed, trying blob fallback:', protocolErr)
    return loadFontFaceFromBytes(familyName, target, ext)
  }
}

export function useFontFace(asset: AssetItem | null): {
  familyName: string
  loaded: boolean
  error: string | null
} {
  const familyName = asset ? fontPreviewFamilyName(asset.id) : ''
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!asset) {
      setLoaded(false)
      setError(null)
      return
    }

    let cancelled = false
    let face: FontFace | null = null

    const current = asset

    async function load() {
      try {
        setLoaded(false)
        setError(null)
        face = await loadFontFaceForAsset(current, familyName)
        if (cancelled) return
        document.fonts.add(face)
        setLoaded(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : i18n.t('preview:fontPreview.loadFailed'))
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      if (face) {
        try {
          document.fonts.delete(face)
        } catch {
          /* ignore */
        }
      }
    }
  }, [asset, familyName])

  return { familyName, loaded, error }
}

export { loadFontFaceForAsset }
