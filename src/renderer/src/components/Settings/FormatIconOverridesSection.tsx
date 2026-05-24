import React, { useCallback, useEffect, useState } from 'react'
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

export function FormatIconOverridesSection(): React.ReactElement {
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
      notify.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveEntries = async (next: FormatIconEntry[]) => {
    setBusy(true)
    try {
      const saved = await persistFormatIconOverrides({ entries: next })
      setEntries(saved.entries)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '保存失败')
      throw e
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async () => {
    const extension = normalizeFormatExtension(draftExt)
    if (!isValidFormatExtension(extension)) {
      notify.warning('请输入有效扩展名（字母数字，不含点，如 blend、hip）')
      return
    }
    if (entries.some((e) => e.extension === extension)) {
      notify.warning(`已存在 .${extension} 的配置`)
      return
    }

    let value = draftEmoji.trim()
    let kind = draftKind

    if (kind === 'image') {
      notify.warning('请先点击「选择图片」为扩展名指定图标')
      return
    }
    if (!value) {
      notify.warning('请输入 emoji 或短文本作为图标')
      return
    }

    try {
      await saveEntries([...entries, { extension, kind, value }])
      setDraftExt('')
      setDraftEmoji('📁')
      notify.success(`已添加 .${extension}`)
    } catch {
      /* notified */
    }
  }

  const handleAddWithImage = async () => {
    const extension = normalizeFormatExtension(draftExt)
    if (!isValidFormatExtension(extension)) {
      notify.warning('请先输入有效扩展名')
      return
    }
    if (entries.some((e) => e.extension === extension)) {
      notify.warning(`已存在 .${extension} 的配置`)
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
      const { path } = await window.assetVaultAPI.settings.importFormatIconImage(
        extension,
        source
      )
      await saveEntries([...entries, { extension, kind: 'image', value: path }])
      setDraftExt('')
      setDraftKind('emoji')
      notify.success(`已添加 .${extension} 图片图标`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '添加失败')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (extension: string) => {
    try {
      await saveEntries(entries.filter((e) => e.extension !== extension))
      notify.success(`已删除 .${extension}`)
    } catch {
      /* notified */
    }
  }

  const handleRestoreDefaults = async () => {
    try {
      await saveEntries([...DEFAULT_FORMAT_ICON_ENTRIES])
      notify.success('已恢复默认无缩略图 3D 格式图标')
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
      const { path } = await window.assetVaultAPI.settings.importFormatIconImage(
        entry.extension,
        source
      )
      const next = entries.map((e) =>
        e.extension === entry.extension ? { ...e, kind: 'image' as const, value: path } : e
      )
      await saveEntries(next)
      notify.success('图标已更新')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : '更新失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 pt-4 border-t border-av-border">
      <div>
        <h4 className="text-sm font-semibold text-av-text-primary">无缩略图格式图标</h4>
        <p className="text-xs text-av-text-muted leading-relaxed mt-1">
          为无法生成缩略图的扩展名指定网格占位图标（emoji 或图片）。匹配扩展名时优先于默认文件类型图标。
        </p>
      </div>

      <div className="rounded-lg border border-av-border bg-av-bg-elevated/40 p-3 space-y-3">
        <p className="text-xs font-medium text-av-text-secondary">添加格式</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-av-text-muted">扩展名</span>
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
            <span className="text-[11px] text-av-text-muted">类型</span>
            <select
              value={draftKind}
              onChange={(e) => setDraftKind(e.target.value as FormatIconKind)}
              className="input-base text-sm w-28"
            >
              <option value="emoji">Emoji / 文本</option>
              <option value="image">图片文件</option>
            </select>
          </label>
          {draftKind === 'emoji' ? (
            <label className="flex flex-col gap-1 flex-1 min-w-[120px]">
              <span className="text-[11px] text-av-text-muted">图标</span>
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
                添加
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={busy}
                onClick={() => void handleAddWithImage()}
              >
                选择图片并添加
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-av-text-muted">
          {loading ? '加载中…' : `已配置 ${entries.length} 个扩展名`}
        </span>
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={busy || loading}
          onClick={() => void handleRestoreDefaults()}
        >
          恢复默认 3D 列表
        </button>
      </div>

      {entries.length === 0 && !loading ? (
        <p className="text-xs text-av-text-muted py-4 text-center border border-dashed border-av-border rounded-lg">
          暂无配置，可添加扩展名或恢复默认列表
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
                  {entry.kind === 'emoji' ? `Emoji：${entry.value}` : '自定义图片'}
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
                    换图
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-[11px] px-2 py-1 rounded text-red-400 hover:bg-red-500/10"
                  disabled={busy}
                  onClick={() => void handleDelete(entry.extension)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
