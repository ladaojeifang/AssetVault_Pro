import React, { useState } from 'react'
import { Modal } from '@arco-design/web-react'
import type { LibraryMode } from '@/shared/libraryTypes'

const MODE_OPTIONS: ReadonlyArray<{
  id: LibraryMode
  title: string
  desc: string
  badgeClass: string
}> = [
  {
    id: 'archive',
    title: '完整库',
    desc: '导入时拷贝原文件到资料库，可整体备份与迁移，适合长期保管。',
    badgeClass: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
  },
  {
    id: 'catalog',
    title: '索引库',
    desc: '仅记录路径与缩略图，不占用双倍磁盘；源文件移动后需重新链接，可稍后转为完整库。',
    badgeClass: 'bg-amber-950/50 text-amber-300 border-amber-800/50'
  }
]

type Props = {
  visible: boolean
  busy: boolean
  onClose: () => void
  onConfirm: (mode: LibraryMode) => void
}

export function CreateLibraryModal({ visible, busy, onClose, onConfirm }: Props): React.ReactElement {
  const [mode, setMode] = useState<LibraryMode>('archive')

  return (
    <Modal
      title="新建资料库"
      visible={visible}
      onCancel={onClose}
      autoFocus={false}
      focusLock
      footer={null}
      className="av-create-library-modal"
      style={{ width: 420 }}
    >
      <p className="text-sm text-av-text-secondary mb-4 leading-relaxed">
        选择资料库类型后，在空文件夹中初始化 <code className="text-xs">manifest.json</code> 与{' '}
        <code className="text-xs">library.sqlite</code>。
      </p>

      <div className="space-y-2 mb-5">
        {MODE_OPTIONS.map((opt) => {
          const selected = mode === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={busy}
              onClick={() => setMode(opt.id)}
              className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                selected
                  ? 'border-av-accent-blue/60 bg-av-accent-blue/10 ring-1 ring-av-accent-blue/30'
                  : 'border-av-border bg-av-bg-elevated/50 hover:border-av-border-light hover:bg-av-bg-hover'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${opt.badgeClass}`}
                >
                  {opt.title}
                </span>
                {selected && (
                  <span className="text-[10px] text-av-accent-blue ml-auto">已选</span>
                )}
              </div>
              <p className="text-xs text-av-text-muted leading-relaxed">{opt.desc}</p>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={busy}
          onClick={() => onConfirm(mode)}
        >
          选择文件夹并创建…
        </button>
      </div>
    </Modal>
  )
}
