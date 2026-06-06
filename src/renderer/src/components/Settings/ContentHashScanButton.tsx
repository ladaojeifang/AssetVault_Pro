import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentHashScanResult } from '@/shared/importTypes'

export function ContentHashScanButton({ disabled }: { disabled?: boolean }): React.ReactElement {
  const { t } = useTranslation('settings')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [result, setResult] = useState<ContentHashScanResult | null>(null)

  useEffect(() => {
    const unsub = window.assetVaultAPI.onContentHashScanProgress((data) => {
      setProgress({ current: data.current, total: data.total })
    })
    return unsub
  }, [])

  const runScan = useCallback(async () => {
    setScanning(true)
    setProgress(null)
    setResult(null)
    try {
      const res = await window.assetVaultAPI.assets.scanContentHashes()
      setResult(res)
    } catch (e) {
      console.error(e)
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }, [])

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-secondary text-xs"
        disabled={disabled || scanning}
        onClick={() => void runScan()}
      >
        {scanning
          ? progress
            ? t('hashScan.busyProgress', progress)
            : t('hashScan.busy')
          : t('hashScan.idle')}
      </button>
      {result && (
        <p className="text-xs text-av-text-muted">
          {t('hashScan.summary', {
            scanned: result.scanned,
            updated: result.updated,
            skipped: result.skipped,
            errorsPart: result.errors > 0 ? t('hashScan.errorsPart', { errors: result.errors }) : ''
          })}
        </p>
      )}
    </div>
  )
}
