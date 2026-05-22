import React, { useCallback, useEffect, useState } from 'react'
import type { FontRegenerateResult } from '@/shared/fontTypes'
import { notify } from '../Common/notify'

export function FontThumbRegenerateButton({ disabled }: { disabled?: boolean }): React.ReactElement {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [result, setResult] = useState<FontRegenerateResult | null>(null)
  const [showFailures, setShowFailures] = useState(false)

  useEffect(() => {
    const unsub = window.assetVaultAPI.onFontThumbRegenerateProgress((data) => {
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
      const res = await window.assetVaultAPI.assets.regenerateFontThumbnails()
      setResult(res)
      if (res.errors > 0) setShowFailures(true)
      else notify.success(`已更新 ${res.updated} 个字体缩略图`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '重建失败')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [])

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
            ? `生成字体缩略图… ${progress.current}/${progress.total}`
            : '生成字体缩略图…'
          : '重建字体缩略图'}
      </button>
      {result && (
        <div className="text-xs text-av-text-muted space-y-1">
          <p>
            共 {result.scanned} 个字体：更新 {result.updated}，跳过 {result.skipped}
            {result.errors > 0 ? `，失败 ${result.errors}` : ''}
          </p>
          {result.failures.length > 0 ? (
            <>
              <button
                type="button"
                className="text-av-accent-blue hover:underline"
                onClick={() => setShowFailures((v) => !v)}
              >
                {showFailures ? '隐藏失败详情' : `查看失败详情 (${result.failures.length})`}
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
