import React, { useCallback, useEffect, useState } from 'react'
import { Modal, Checkbox } from '@arco-design/web-react'
import type { DuplicateImportAnswer, DuplicateImportPromptPayload } from '@/shared/importTypes'
import { formatFileSize } from '@/shared/types'

export function DuplicateImportBridge(): null {
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
      : '（未分配到文件夹）'

  return (
    <Modal
      visible={open}
      title="检测到重复文件"
      footer={null}
      maskClosable={false}
      escToExit={false}
      onCancel={() => void respond('cancel')}
      className="duplicate-import-modal"
    >
      <div className="duplicate-import-body">
        <p className="text-sm text-av-text-secondary leading-relaxed">
          「<strong className="text-av-text">{payload.sourceName}</strong>」与库内已有资产内容相同（SHA-256
          一致，{formatFileSize(payload.fileSize)}）。
        </p>

        <div className="duplicate-import-existing">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="duplicate-import-thumb" draggable={false} />
          ) : (
            <div className="duplicate-import-thumb duplicate-import-thumb--empty">预览</div>
          )}
          <div className="duplicate-import-meta">
            <div className="duplicate-import-meta-row">
              <span className="duplicate-import-label">库内名称</span>
              <span>{payload.existing.originalName || payload.existing.filename}</span>
            </div>
            <div className="duplicate-import-meta-row">
              <span className="duplicate-import-label">导入时间</span>
              <span>{importedDate}</span>
            </div>
            <div className="duplicate-import-meta-row">
              <span className="duplicate-import-label">所在文件夹</span>
              <span>{folderHint}</span>
            </div>
          </div>
        </div>

        <Checkbox checked={applyToAll} onChange={setApplyToAll} className="duplicate-import-apply-all">
          本次导入全部相同处理
        </Checkbox>

        <div className="duplicate-import-actions">
          <button type="button" className="btn-primary" onClick={() => void respond('use_existing')}>
            使用已有资产
          </button>
          <button type="button" className="btn-secondary" onClick={() => void respond('import_copy')}>
            仍要再存一份
          </button>
          <button type="button" className="btn-ghost text-av-text-muted" onClick={() => void respond('cancel')}>
            取消
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default DuplicateImportBridge
