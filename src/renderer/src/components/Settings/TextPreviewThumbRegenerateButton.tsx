import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface TextPreviewThumbRegenerateButtonProps {
  disabled?: boolean
}

export const TextPreviewThumbRegenerateButton: React.FC<TextPreviewThumbRegenerateButtonProps> = ({ disabled }) => {
  const { t } = useTranslation('settings')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  const handleRegenerate = useCallback(async () => {
    setBusy(true)
    setSummary(null)
    try {
      const api = (window as any).assetVault
      if (!api?.regenerateTextPreviewThumbnails) return
      const cleanup = api.onTextPreviewThumbRegenerateProgress?.((payload: any) => {
        if (payload.type === 'done') {
          setSummary(
            t('thumbRegenerate.textPreviewSummary', {
              scanned: payload.scanned,
              updated: payload.updated,
              skipped: payload.skipped,
              errorsPart: payload.errors > 0 ? `, errors: ${payload.errors}` : ''
            })
          )
        }
      })
      await api.regenerateTextPreviewThumbnails()
      cleanup?.()
    } catch (err) {
      console.error('Text preview thumb regenerate failed:', err)
    } finally {
      setBusy(false)
    }
  }, [t])

  return (
    <div className="flex flex-col gap-1">
      <button
        className="px-3 py-2 text-sm rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={disabled || busy}
        onClick={handleRegenerate}
      >
        {busy ? t('thumbRegenerate.textPreviewBusy') : t('thumbRegenerate.textPreviewIdle')}
      </button>
      {summary && <p className="text-xs text-gray-500">{summary}</p>}
    </div>
  )
}
