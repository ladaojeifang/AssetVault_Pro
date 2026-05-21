import React, { memo, useCallback, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useBaseAssetActions } from './AiCanvasBaseAssetContext'
import VideoPreviewPlayer from './VideoPreviewPlayer'

const BaseVideoNodeInner: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { loadLocalVideo } = useBaseAssetActions()
  const displayIndex = Number(data.displayIndex) || 1
  const previewUrl = data.previewUrl as string | undefined
  const label = (data.label as string) ?? ''
  const assetId = data.assetId as string | undefined
  const [busy, setBusy] = useState(false)

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const onPick = useCallback(() => {
    if (busy) return
    setBusy(true)
    void loadLocalVideo(id).finally(() => setBusy(false))
  }, [busy, id, loadLocalVideo])

  const hasVideo = Boolean(previewUrl && assetId)

  return (
    <div
      className={`ai-base-node ai-base-node--video ${selected ? 'ai-base-node--selected' : ''}`}
      onDoubleClick={stop}
    >
      <Handle type="target" position={Position.Left} id="in" className="ai-flow-handle" />
      <Handle type="source" position={Position.Right} id="out" className="ai-flow-handle" />

      <div className="ai-base-node-header">
        <span className="ai-base-node-title">视频素材 {displayIndex}</span>
      </div>

      <div className="ai-base-node-body nodrag">
        {hasVideo ? (
          <div className="ai-base-node-media-wrap ai-base-node-media-wrap--video">
            <VideoPreviewPlayer src={previewUrl!} className="ai-video-preview--base" />
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
            <span>{busy ? '导入中…' : '加载本地视频'}</span>
            <span className="ai-base-node-pick-hint">导入后将写入素材库</span>
          </button>
        )}
        {label ? <span className="ai-base-node-label">{label}</span> : null}
      </div>
    </div>
  )
}

export const BaseVideoNode = memo(BaseVideoNodeInner)
BaseVideoNode.displayName = 'BaseVideoNode'
