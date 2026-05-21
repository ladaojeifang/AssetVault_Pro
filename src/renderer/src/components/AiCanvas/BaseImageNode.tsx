import React, { memo, useCallback, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useBaseAssetActions } from './AiCanvasBaseAssetContext'

const BaseImageNodeInner: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { loadLocalImage } = useBaseAssetActions()
  const displayIndex = Number(data.displayIndex) || 1
  const previewUrl = data.previewUrl as string | undefined
  const label = (data.label as string) ?? ''
  const assetId = data.assetId as string | undefined
  const [busy, setBusy] = useState(false)

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const onPick = useCallback(() => {
    if (busy) return
    setBusy(true)
    void loadLocalImage(id).finally(() => setBusy(false))
  }, [busy, id, loadLocalImage])

  const hasImage = Boolean(previewUrl && assetId)

  return (
    <div
      className={`ai-base-node ai-base-node--image ${selected ? 'ai-base-node--selected' : ''}`}
      onDoubleClick={stop}
    >
      <Handle type="target" position={Position.Left} id="in" className="ai-flow-handle" />
      <Handle type="source" position={Position.Right} id="out" className="ai-flow-handle" />

      <div className="ai-base-node-header">
        <span className="ai-base-node-title">图片素材 {displayIndex}</span>
      </div>

      <div className="ai-base-node-body nodrag">
        {hasImage ? (
          <div className="ai-base-node-media-wrap">
            <img src={previewUrl} alt="" className="ai-base-node-media" draggable={false} />
            <button
              type="button"
              className="ai-base-node-replace nodrag titlebar-no-drag"
              onClick={(e) => {
                stop(e)
                onPick()
              }}
              disabled={busy}
            >
              {busy ? '导入中…' : '更换'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="ai-base-node-pick nodrag titlebar-no-drag"
            onClick={(e) => {
              stop(e)
              onPick()
            }}
            disabled={busy}
          >
            <span className="ai-base-node-pick-icon">+</span>
            <span>{busy ? '导入中…' : '加载本地图片'}</span>
            <span className="ai-base-node-pick-hint">导入后将写入素材库</span>
          </button>
        )}
        {label ? <span className="ai-base-node-label">{label}</span> : null}
      </div>
    </div>
  )
}

export const BaseImageNode = memo(BaseImageNodeInner)
BaseImageNode.displayName = 'BaseImageNode'
