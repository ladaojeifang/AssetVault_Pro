import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@arco-design/web-react'
import type { LibraryMode } from '@/shared/libraryTypes'

type Props = {
  visible: boolean
  busy: boolean
  onClose: () => void
  onConfirm: (mode: LibraryMode) => void
}

export function CreateLibraryModal({ visible, busy, onClose, onConfirm }: Props): React.ReactElement {
  const { t } = useTranslation('library')
  const { t: tc } = useTranslation('common')
  const [mode, setMode] = useState<LibraryMode>('archive')

  const modeOptions: ReadonlyArray<{
    id: LibraryMode
    title: string
    desc: string
    badgeClass: string
  }> = [
    {
      id: 'archive',
      title: t('archiveOptionTitle'),
      desc: t('archiveOptionDesc'),
      badgeClass: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
    },
    {
      id: 'catalog',
      title: t('catalogOptionTitle'),
      desc: t('catalogOptionDesc'),
      badgeClass: 'bg-amber-950/50 text-amber-300 border-amber-800/50'
    },
    {
      id: 'embedded',
      title: t('embeddedOptionTitle'),
      desc: t('embeddedOptionDesc'),
      badgeClass: 'bg-blue-950/40 text-blue-300 border-blue-800/40'
    }
  ]

  const intro =
    mode === 'embedded' ? t('createModalIntroEmbedded') : t('createModalIntro')
  const confirmLabel =
    mode === 'embedded' ? t('embeddedPickFolderCreate') : t('pickFolderCreate')

  return (
    <Modal
      title={t('createModalTitle')}
      visible={visible}
      onCancel={onClose}
      autoFocus={false}
      focusLock
      footer={null}
      className="av-create-library-modal"
      style={{ width: 420 }}
    >
      <p className="text-sm text-av-text-secondary mb-4 leading-relaxed">{intro}</p>

      <div className="space-y-2 mb-5">
        {modeOptions.map((opt) => {
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
                  <span className="text-[10px] text-av-accent-blue ml-auto">{t('selected')}</span>
                )}
              </div>
              <p className="text-xs text-av-text-muted leading-relaxed">{opt.desc}</p>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={onClose}>
          {tc('cancel')}
        </button>
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={busy}
          onClick={() => onConfirm(mode)}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
