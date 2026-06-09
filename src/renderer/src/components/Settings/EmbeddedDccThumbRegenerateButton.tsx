import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface EmbeddedDccThumbRegenerateButtonProps {
  disabled?: boolean
}

export const EmbeddedDccThumbRegenerateButton: React.FC<EmbeddedDccThumbRegenerateButtonProps> = ({ disabled }) => {
  const { t } = useTranslation('settings')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  const handleRegenerate = useCallback(async () => {
    setBusy(true)
    setSummary(null)
    try {
      const api = (window as any).assetVault
      if (!api?.regenerateEmbeddedDccThumbnails) return
      const cleanup = api.onEmbeddedDccThumbRegenerateProgress?.((payload: any) => {
        if (payload.type === 'done') {
          setSummary(
            t('thumbRegenerate.embeddedSummary', {
              scanned: payload.scanned,
              updated: payload.updated,
              skipped: payload.skipped,
              errorsPart: payload.errors > 0 ? `, errors: ${payload.errors}` : ''
            })
          )
        }
      })
      await api.regenerateEmbeddedDccThumbnails()
      cleanup?.()
    } catch (err) {
      console.error('Embedded DCC thumb regenerate failed:', err)
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
        {busy ? t('thumbRegenerate.embeddedBusy') : t('thumbRegenerate.embeddedIdle')}
      </button>
      {summary && <p className="text-xs text-gray-500">{summary}</p>}
    </div>
  )
}
