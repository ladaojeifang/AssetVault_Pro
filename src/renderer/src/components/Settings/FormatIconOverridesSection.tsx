import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_FORMAT_ICON_ENTRIES,
  isValidFormatExtension,
  normalizeFormatExtension,
  type FormatIconEntry,
  type FormatIconKind
} from '@/shared/formatIconOverrides'
import { persistFormatIconOverrides } from '../../stores/FormatIconOverridesContext'
import { notify } from '../Common/notify'
import { FileTypePlaceholder } from '../Common/FileTypePlaceholder'
import { DESTRUCTIVE_TEXT_BUTTON_CLASS } from '../../theme/destructiveActionClasses'

export function FormatIconOverridesSection(): React.ReactElement {
  const { t } = useTranslation(['settings', 'common'])
  const [entries, setEntries] = useState<FormatIconEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [draftExt, setDraftExt] = useState('')
  const [draftKind, setDraftKind] = useState<FormatIconKind>('emoji')
  const [draftEmoji, setDraftEmoji] = useState('📁')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await window.assetVaultAPI.settings.getFormatIconOverrides()
      setEntries(s.entries)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('settings:formatIcons.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const saveEntries = async (next: FormatIconEntry[]) => {
    setBusy(true)
    try {
      const saved = await persistFormatIconOverrides({ entries: next })
      setEntries(saved.entries)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('settings:formatIcons.saveFailed'))
      throw e
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async () => {
    const extension = normalizeFormatExtension(draftExt)
    if (!isValidFormatExtension(extension)) {
      notify.warning(t('settings:formatIcons.invalidExtension'))
      return
    }
    if (entries.some((e) => e.extension === extension)) {
      notify.warning(t('settings:formatIcons.extensionExists', { ext: extension }))
      return
    }

    const value = draftEmoji.trim()
    const kind = draftKind

    if (kind === 'image') {
      notify.warning(t('settings:formatIcons.pickImageFirst'))
      return
    }
    if (!value) {
      notify.warning(t('settings:formatIcons.enterEmoji'))
      return
    }

    try {
      await saveEntries([...entries, { extension, kind, value }])
      setDraftExt('')
      setDraftEmoji('📁')
      notify.success(t('settings:formatIcons.added', { ext: extension }))
    } catch {
      /* notified */
    }
  }

  const handleAddWithImage = async () => {
    const extension = normalizeFormatExtension(draftExt)
    if (!isValidFormatExtension(extension)) {
      notify.warning(t('settings:formatIcons.enterExtensionFirst'))
      return
    }
    if (entries.some((e) => e.extension === extension)) {
      notify.warning(t('settings:formatIcons.extensionExists', { ext: extension }))
      return
    }

    const paths = await window.assetVaultAPI.fs.selectDialog({
      multi: false,
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico']
        }
      ]
    })
    const source = paths[0]
    if (!source) return

    setBusy(true)
    try {
      const { path } = await window.assetVaultAPI.settings.importFormatIconImage(extension, source)
      await saveEntries([...entries, { extension, kind: 'image', value: path }])
      setDraftExt('')
      setDraftKind('emoji')
      notify.success(t('settings:formatIcons.addedImage', { ext: extension }))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('settings:formatIcons.addFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (extension: string) => {
    try {
      await saveEntries(entries.filter((e) => e.extension !== extension))
      notify.success(t('settings:formatIcons.deleted', { ext: extension }))
    } catch {
      /* notified */
    }
  }

  const handleRestoreDefaults = async () => {
    try {
      await saveEntries([...DEFAULT_FORMAT_ICON_ENTRIES])
      notify.success(t('settings:formatIcons.restoredDefaults'))
    } catch {
      /* notified */
    }
  }

  const handleReplaceImage = async (entry: FormatIconEntry) => {
    const paths = await window.assetVaultAPI.fs.selectDialog({
      multi: false,
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico']
        }
      ]
    })
    const source = paths[0]
    if (!source) return

    setBusy(true)
    try {
      const { path } = await window.assetVaultAPI.settings.importFormatIconImage(entry.extension, source)
      const next = entries.map((e) =>
        e.extension === entry.extension ? { ...e, kind: 'image' as const, value: path } : e
      )
      await saveEntries(next)
      notify.success(t('settings:formatIcons.iconUpdated'))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : t('settings:formatIcons.updateFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 pt-4 border-t border-av-border">
      <div>
        <h4 className="text-sm font-semibold text-av-text-primary">{t('settings:formatIcons.title')}</h4>
        <p className="text-xs text-av-text-muted leading-relaxed mt-1">{t('settings:formatIcons.intro')}</p>
      </div>

      <div className="rounded-lg border border-av-border bg-av-bg-elevated/40 p-3 space-y-3">
        <p className="text-xs font-medium text-av-text-secondary">{t('settings:formatIcons.addFormat')}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-av-text-muted">{t('settings:formatIcons.extension')}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-av-text-muted">.</span>
              <input
                type="text"
                value={draftExt}
                onChange={(e) => setDraftExt(e.target.value.replace(/^\./, ''))}
                placeholder="blend"
                className="input-base w-28 text-sm"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-av-text-muted">{t('settings:formatIcons.kind')}</span>
            <select
              value={draftKind}
              onChange={(e) => setDraftKind(e.target.value as FormatIconKind)}
              className="input-base text-sm w-28"
            >
              <option value="emoji">{t('settings:formatIcons.kindEmoji')}</option>
              <option value="image">{t('settings:formatIcons.kindImage')}</option>
            </select>
          </label>
          {draftKind === 'emoji' ? (
            <label className="flex flex-col gap-1 flex-1 min-w-[120px]">
              <span className="text-[11px] text-av-text-muted">{t('settings:formatIcons.icon')}</span>
              <input
                type="text"
                value={draftEmoji}
                onChange={(e) => setDraftEmoji(e.target.value)}
                placeholder="📁"
                className="input-base text-sm w-full max-w-[200px]"
              />
            </label>
          ) : null}
          <div className="flex gap-2 pb-0.5">
            {draftKind === 'emoji' ? (
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={busy}
                onClick={() => void handleAdd()}
              >
                {t('settings:formatIcons.add')}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={busy}
                onClick={() => void handleAddWithImage()}
              >
                {t('settings:formatIcons.pickImageAdd')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-av-text-muted">
          {loading ? t('settings:formatIcons.loading') : t('settings:formatIcons.configuredCount', { count: entries.length })}
        </span>
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={busy || loading}
          onClick={() => void handleRestoreDefaults()}
        >
          {t('settings:formatIcons.restoreDefaults')}
        </button>
      </div>

      {entries.length === 0 && !loading ? (
        <p className="text-xs text-av-text-muted py-4 text-center border border-dashed border-av-border rounded-lg">
          {t('settings:formatIcons.emptyHint')}
        </p>
      ) : (
        <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {entries.map((entry) => (
            <li
              key={entry.extension}
              className="flex items-center gap-3 rounded-lg border border-av-border px-3 py-2 bg-av-bg-primary/50"
            >
              <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 border border-av-border/60">
                <FileTypePlaceholder
                  fileType="other"
                  extension={entry.extension}
                  override={entry}
                  size="sm"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-av-text-primary">.{entry.extension}</p>
                <p className="text-[11px] text-av-text-muted truncate">
                  {entry.kind === 'emoji' ? `Emoji: ${entry.value}` : t('settings:formatIcons.customImage')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {entry.kind === 'image' ? (
                  <button
                    type="button"
                    className="btn-secondary text-[11px] px-2 py-1"
                    disabled={busy}
                    onClick={() => void handleReplaceImage(entry)}
                  >
                    {t('settings:formatIcons.replaceImage')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`text-[11px] px-2 py-1 ${DESTRUCTIVE_TEXT_BUTTON_CLASS}`}
                  disabled={busy}
                  onClick={() => void handleDelete(entry.extension)}
                >
                  {t('common:delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
