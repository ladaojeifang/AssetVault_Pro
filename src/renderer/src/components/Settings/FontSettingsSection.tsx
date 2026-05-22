import React, { useCallback, useEffect, useState } from 'react'
import { FONT_THUMB_SAMPLE_VERSION } from '@/shared/fontSettings'
import type { FontAppSettings } from '@/shared/fontSettings'
import { notify } from '../Common/notify'

export function FontSettingsSection(): React.ReactElement {
  const [settings, setSettings] = useState<FontAppSettings | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const s = await window.assetVaultAPI.fonts.getSettings()
    setSettings(s)
    setDraft(s.thumbSampleText)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setBusy(true)
    try {
      const textChanged = settings != null && draft !== settings.thumbSampleText
      const nextVersion = textChanged
        ? (settings?.thumbSampleVersion ?? FONT_THUMB_SAMPLE_VERSION) + 1
        : (settings?.thumbSampleVersion ?? FONT_THUMB_SAMPLE_VERSION)
      const next = await window.assetVaultAPI.fonts.setSettings({
        thumbSampleText: draft,
        thumbSampleVersion: nextVersion
      })
      setSettings(next)
      notify.success('字体设置已保存；可重建缩略图以应用新样例文字')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 pt-4 border-t border-av-border">
      <h4 className="text-sm font-semibold text-av-text-primary">字体</h4>
      <p className="text-xs text-av-text-muted leading-relaxed">
        缩略图样例文字（支持换行）。修改后请使用下方「重建字体缩略图」。品牌字体包建议为文件夹添加标签{' '}
        <code className="px-1 rounded bg-av-bg-elevated">brand-font-pack</code>。
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        className="input-base w-full text-sm resize-y min-h-[72px]"
        placeholder="VibeShotClub&#10;AIGC创作"
      />
      <div className="flex items-center gap-2">
        <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void save()}>
          保存字体设置
        </button>
        {settings ? (
          <span className="text-[11px] text-av-text-muted">版本 v{settings.thumbSampleVersion}</span>
        ) : null}
      </div>
    </div>
  )
}
