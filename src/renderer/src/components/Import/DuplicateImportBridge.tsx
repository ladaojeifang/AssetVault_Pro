import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Checkbox } from '@arco-design/web-react'
import type { DuplicateImportAnswer, DuplicateImportPromptPayload } from '@/shared/importTypes'
import { formatFileSize } from '@/shared/types'

export function DuplicateImportBridge(): React.ReactElement | null {
  const { t } = useTranslation(['import', 'common'])
  const [open, setOpen] = useState(false)
  const [payload, setPayload] = useState<DuplicateImportPromptPayload | null>(null)
  const [applyToAll, setApplyToAll] = useState(false)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  const respond = useCallback(
    async (resolution: DuplicateImportAnswer['resolution']) => {
      if (!payload) return
      const answer: DuplicateImportAnswer = {
        resolution,
        applyToAll: applyToAll && resolution !== 'cancel'
      }
      setOpen(false)
      setPayload(null)
      setApplyToAll(false)
      setThumbUrl(null)
      await window.assetVaultAPI.answerDuplicateImport(payload.requestId, answer)
    },
    [payload, applyToAll]
  )

  useEffect(() => {
    const unsub = window.assetVaultAPI.onDuplicateImportPrompt((p) => {
      setPayload(p)
      setApplyToAll(false)
      setOpen(true)
      setThumbUrl(null)
      void window.assetVaultAPI.assets.getThumbnail(p.existing.id).then((url) => {
        if (url) setThumbUrl(url)
      })
    })
    return unsub
  }, [])

  if (!payload) return null

  const importedDate = (() => {
    try {
      return new Date(payload.existing.importedAt).toLocaleString()
    } catch {
      return payload.existing.importedAt
    }
  })()

  const folderHint =
    payload.existing.folderNames.length > 0
      ? payload.existing.folderNames.join('、')
      : t('import:noFolder')

  return (
    <Modal
      visible={open}
      title={t('import:duplicateTitle')}
      footer={null}
      maskClosable={false}
      escToExit={false}
      onCancel={() => void respond('cancel')}
      className="duplicate-import-modal"
    >
      <div className="duplicate-import-body">
        <p className="text-sm text-av-text-secondary leading-relaxed">
          {t('import:duplicateIntro', {
            name: payload.sourceName,
            size: formatFileSize(payload.fileSize)
          })}
        </p>

        <div className="duplicate-import-existing">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="duplicate-import-thumb" draggable={false} />
          ) : (
            <div className="duplicate-import-thumb duplicate-import-thumb--empty">{t('common:preview')}</div>
          )}
          <div className="duplicate-import-meta">
            <div className="duplicate-import-meta-row">
              <span className="duplicate-import-label">{t('import:existingName')}</span>
              <span>{payload.existing.originalName || payload.existing.filename}</span>
            </div>
            <div className="duplicate-import-meta-row">
              <span className="duplicate-import-label">{t('import:existingImported')}</span>
              <span>{importedDate}</span>
            </div>
            <div className="duplicate-import-meta-row">
              <span className="duplicate-import-label">{t('import:existingFolders')}</span>
              <span>{folderHint}</span>
            </div>
          </div>
        </div>

        <Checkbox checked={applyToAll} onChange={setApplyToAll} className="duplicate-import-apply-all">
          {t('import:applyToAllBatch')}
        </Checkbox>

        <div className="duplicate-import-actions">
          <button type="button" className="btn-primary" onClick={() => void respond('use_existing')}>
            {t('import:useExisting')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => void respond('import_copy')}>
            {t('import:importCopyAnyway')}
          </button>
          <button type="button" className="btn-ghost text-av-text-muted" onClick={() => void respond('cancel')}>
            {t('common:cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default DuplicateImportBridge
