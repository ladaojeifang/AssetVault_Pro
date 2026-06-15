import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextPreviewRegenerateResult } from '@/shared/textPreviewFormats'
import { notify } from '../Common/notify'

export function TextPreviewThumbRegenerateButton({
  disabled
}: {
  disabled?: boolean
}): React.ReactElement {
  const { t } = useTranslation('settings')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [result, setResult] = useState<TextPreviewRegenerateResult | null>(null)
  const [showFailures, setShowFailures] = useState(false)

  useEffect(() => {
    const unsub = window.assetVaultAPI.onTextPreviewThumbRegenerateProgress((data) => {
      setProgress({ current: data.current, total: data.total })
    })
    return unsub
  }, [])

  const run = useCallback(async () => {
    setBusy(true)
    setProgress(null)
    setResult(null)
    setShowFailures(false)
    try {
      const res = await window.assetVaultAPI.assets.regenerateTextPreviewThumbnails()
      setResult(res)
      if (res.errors > 0) setShowFailures(true)
      else notify.success(t('thumbRegenerate.textPreviewSuccess', { count: res.updated }))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('thumbRegenerate.failed'))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [t])

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-secondary text-xs"
        disabled={disabled || busy}
        onClick={() => void run()}
      >
        {busy
          ? progress
            ? t('thumbRegenerate.textPreviewBusyProgress', progress)
            : t('thumbRegenerate.textPreviewBusy')
          : t('thumbRegenerate.textPreviewIdle')}
      </button>
      {result && (
        <div className="text-xs text-av-text-muted space-y-1">
          <p>
            {t('thumbRegenerate.textPreviewSummary', {
              scanned: result.scanned,
              updated: result.updated,
              skipped: result.skipped,
              errorsPart:
                result.errors > 0
                  ? t('thumbRegenerate.textPreviewErrorsPart', { errors: result.errors })
                  : ''
            })}
          </p>
          {result.failures.length > 0 ? (
            <>
              <button
                type="button"
                className="text-av-accent-blue hover:underline"
                onClick={() => setShowFailures((v) => !v)}
              >
                {showFailures
                  ? t('thumbRegenerate.hideFailures')
                  : t('thumbRegenerate.showFailures', { count: result.failures.length })}
              </button>
              {showFailures ? (
                <ul className="max-h-32 overflow-y-auto space-y-1 rounded border border-av-border bg-av-bg-elevated/50 p-2">
                  {result.failures.map((f) => (
                    <li key={f.assetId} className="text-[11px] leading-snug">
                      <span className="text-av-text-secondary">{f.filename}</span>
                      <span className="text-av-text-muted"> — {f.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
