import { useEffect, useRef, useState } from 'react'
import type { FontPreviewRenderRequest } from '@/shared/fontTypes'

export function useFontPreviewRender(
  request: FontPreviewRenderRequest | null,
  debounceMs = 280
): { dataUrl: string | null; loading: boolean; error: string | null } {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const genRef = useRef(0)

  useEffect(() => {
    if (!request?.filePath || !request.sampleText.trim()) {
      setDataUrl(null)
      setLoading(false)
      setError(null)
      return
    }

    const gen = ++genRef.current
    setLoading(true)
    setError(null)

    const timer = window.setTimeout(() => {
      void window.assetVaultAPI.fonts.renderPreview(request).then((res) => {
        if (genRef.current !== gen) return
        if (res.ok) {
          setDataUrl(res.dataUrl)
          setError(null)
        } else {
          setDataUrl(null)
          setError(res.error)
        }
        setLoading(false)
      })
    }, debounceMs)

    return () => window.clearTimeout(timer)
  }, [
    request?.filePath,
    request?.sampleText,
    request?.ttcIndex,
    request?.canvasWidth,
    request?.canvasHeight,
    request?.fontSizePx,
    request?.lineHeight,
    request?.letterSpacingPx,
    request?.textAlign,
    request?.backgroundColor,
    request?.textColor,
    debounceMs
  ])

  return { dataUrl, loading, error }
}
