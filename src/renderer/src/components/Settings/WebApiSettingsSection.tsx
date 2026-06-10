import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppPreferences } from '@/shared/appPreferences'
import type { WebApiPreferences } from '@/shared/webApiPreferences'
import { DEFAULT_WEB_API_PREFERENCES } from '@/shared/webApiPreferences'
import { useAppLocale } from '../../stores/LocaleContext'

type WebApiStatus = {
  running: boolean
  enabled: boolean
  baseUrl: string
  playgroundUrl: string
  openApiUrl: string
  port: number
  bind: string
  allowRemote: boolean
  token: string
}

function SettingField({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-av-text-primary">{label}</label>
      {description && <p className="text-xs text-av-text-muted">{description}</p>}
      {children}
    </div>
  )
}

export function WebApiSettingsSection({
  prefs,
  onUpdateWebApi
}: {
  prefs: AppPreferences
  onUpdateWebApi: (webApi: WebApiPreferences) => void
}) {
  const { t } = useTranslation('settings')
  const { locale } = useAppLocale()
  const w = prefs.webApi ?? { ...DEFAULT_WEB_API_PREFERENCES }
  const [status, setStatus] = useState<WebApiStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshStatus = useCallback(() => {
    void window.assetVaultAPI.settings.getWebApiStatus().then(setStatus)
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus, prefs.webApi])

  const patch = (partial: Partial<WebApiPreferences>) => {
    onUpdateWebApi({ ...w, ...partial })
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4 pt-4 border-t border-av-border">
      <h4 className="text-sm font-semibold text-av-text-primary">{t('webApi.title')}</h4>

      <SettingField label={t('webApi.enableLabel')} description={t('webApi.enableDesc')}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={w.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
            className="w-4 h-4 rounded bg-av-bg-elevated border-av-border"
          />
          <span className="text-sm text-av-text-secondary">{t('webApi.enableCheckbox')}</span>
          {status && (
            <span
              className={`text-xs ml-2 ${status.running ? 'text-av-status-success' : 'text-av-text-muted'}`}
            >
              {status.running ? t('webApi.running') : t('webApi.notListening')}
            </span>
          )}
        </label>
      </SettingField>

      <SettingField label={t('webApi.portLabel')} description={t('webApi.portDesc')}>
        <input
          type="number"
          min={1024}
          max={65535}
          value={w.port}
          onChange={(e) => patch({ port: Number(e.target.value) })}
          className="input-base w-32"
          disabled={!w.enabled}
        />
      </SettingField>

      <SettingField label={t('webApi.allowRemoteLabel')} description={t('webApi.allowRemoteDesc')}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={w.allowRemote}
            onChange={(e) =>
              patch({
                allowRemote: e.target.checked,
                bind: e.target.checked ? '0.0.0.0' : '127.0.0.1'
              })
            }
            className="w-4 h-4 rounded bg-av-bg-elevated border-av-border"
            disabled={!w.enabled}
          />
          <span className="text-sm text-av-text-secondary">allowRemote</span>
        </label>
      </SettingField>

      {w.allowRemote && (
        <SettingField label={t('webApi.tokenLabel')} description={t('webApi.tokenDesc')}>
          <div className="flex flex-wrap gap-2 items-center">
            <code className="text-xs bg-av-bg-elevated px-2 py-1 rounded break-all max-w-full">
              {w.token || t('webApi.tokenPlaceholder')}
            </code>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!w.token}
              onClick={() => void copyText(w.token)}
            >
              {t('webApi.copy')}
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={busy || !w.enabled}
              onClick={() => {
                setBusy(true)
                void window.assetVaultAPI.settings
                  .regenerateWebApiToken()
                  .then((s) => {
                    onUpdateWebApi({
                      ...w,
                      token: s.token,
                      allowRemote: true,
                      bind: '0.0.0.0'
                    })
                    setStatus(s)
                  })
                  .finally(() => setBusy(false))
              }}
            >
              {t('webApi.regenerate')}
            </button>
          </div>
        </SettingField>
      )}

      {status && (
        <SettingField label={t('webApi.baseUrlLabel')}>
          <div className="flex flex-wrap gap-2 items-center">
            <code className="text-xs text-av-accent-blue break-all">{status.baseUrl}/</code>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => void copyText(`${status.baseUrl}/`)}
            >
              {t('webApi.copy')}
            </button>
          </div>
        </SettingField>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={!status?.playgroundUrl}
          onClick={() => {
            if (status?.playgroundUrl) {
              const url = new URL(status.playgroundUrl)
              url.searchParams.set('lang', locale === 'en-US' ? 'en' : 'zh')
              void window.assetVaultAPI.settings.openWebApiPlayground(url.toString())
            }
          }}
        >
          {t('webApi.openPlayground')}
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={refreshStatus}>
          {t('webApi.refreshStatus')}
        </button>
      </div>

      <p className="text-xs text-av-text-muted">
        {t('webApi.docsHint', {
          guide: 'doc/web-api-v1-guide.md',
          design: 'doc/web-api-v1-design.md',
          openapi: 'doc/web-api-v1-openapi.yaml'
        })}
      </p>
    </div>
  )
}
