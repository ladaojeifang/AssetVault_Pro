import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FONT_THUMB_SAMPLE_VERSION } from '@/shared/fontSettings'
import type { FontAppSettings } from '@/shared/fontSettings'
import { notify } from '../Common/notify'

export function FontSettingsSection(): React.ReactElement {
  const { t } = useTranslation('settings')
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
      notify.success(t('fontSettings.saved'))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('fontSettings.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 pt-4 border-t border-av-border">
      <h4 className="text-sm font-semibold text-av-text-primary">{t('fontSettings.title')}</h4>
      <p className="text-xs text-av-text-muted leading-relaxed">
        {t('fontSettings.intro')}{' '}
        <code className="px-1 rounded bg-av-bg-elevated">brand-font-pack</code>
        {t('fontSettings.introEnd')}
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
          {t('fontSettings.save')}
        </button>
        {settings ? (
          <span className="text-[11px] text-av-text-muted">
            {t('fontSettings.version', { version: settings.thumbSampleVersion })}
          </span>
        ) : null}
      </div>
    </div>
  )
}
