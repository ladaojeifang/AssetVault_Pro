import React, { useCallback, useEffect, useState } from 'react'
import type { ContentHashScanResult } from '@/shared/importTypes'

export function ContentHashScanButton({ disabled }: { disabled?: boolean }): React.ReactElement {
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
            ? `扫描中… ${progress.current}/${progress.total}`
            : '扫描中…'
          : '扫描并更新内容指纹'}
      </button>
      {result && (
        <p className="text-xs text-av-text-muted">
          共 {result.scanned} 条：更新 {result.updated}，跳过 {result.skipped}
          {result.errors > 0 ? `，失败 ${result.errors}` : ''}
        </p>
      )}
    </div>
  )
}
