import React, { useCallback, useEffect, useState } from 'react'
import type { AppPreferences } from '@/shared/appPreferences'
import type { WebApiPreferences } from '@/shared/webApiPreferences'
import { DEFAULT_WEB_API_PREFERENCES } from '@/shared/webApiPreferences'

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
      <h4 className="text-sm font-semibold text-av-text-primary">开发者 · Web API</h4>

      <SettingField
        label="启用 Web API"
        description="应用运行时在本机提供 HTTP 接口（关闭后端口不监听）"
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={w.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
            className="w-4 h-4 rounded bg-av-bg-elevated border-av-border"
          />
          <span className="text-sm text-av-text-secondary">启用</span>
          {status && (
            <span
              className={`text-xs ml-2 ${status.running ? 'text-green-500' : 'text-av-text-muted'}`}
            >
              {status.running ? '● 运行中' : '○ 未监听'}
            </span>
          )}
        </label>
      </SettingField>

      <SettingField label="端口" description="默认 41596（保存后生效）">
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

      <SettingField
        label="允许局域网 / 远程访问"
        description="监听 0.0.0.0 并要求 Bearer Token；仅在你信任的网络中开启"
      >
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
        <SettingField label="API Token" description="远程请求须携带 Authorization: Bearer …">
          <div className="flex flex-wrap gap-2 items-center">
            <code className="text-xs bg-av-bg-elevated px-2 py-1 rounded break-all max-w-full">
              {w.token || '（保存后自动生成）'}
            </code>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!w.token}
              onClick={() => void copyText(w.token)}
            >
              复制
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
              重新生成
            </button>
          </div>
        </SettingField>
      )}

      {status && (
        <SettingField label="Base URL">
          <div className="flex flex-wrap gap-2 items-center">
            <code className="text-xs text-av-accent-blue break-all">{status.baseUrl}/</code>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => void copyText(`${status.baseUrl}/`)}
            >
              复制
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
              void window.assetVaultAPI.settings.openWebApiPlayground(status.playgroundUrl)
            }
          }}
        >
          打开 Playground
        </button>
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={refreshStatus}
        >
          刷新状态
        </button>
      </div>

      <p className="text-xs text-av-text-muted">
        使用说明见 <code className="text-av-text-secondary">doc/web-api-v1-guide.md</code>
        ；设计稿 <code className="text-av-text-secondary">doc/web-api-v1-design.md</code>
        ；OpenAPI <code className="text-av-text-secondary">doc/web-api-v1-openapi.yaml</code>
      </p>
    </div>
  )
}
