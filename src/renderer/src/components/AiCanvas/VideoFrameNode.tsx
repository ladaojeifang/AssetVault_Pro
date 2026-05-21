import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { notify } from '../Common/notify'

export const VideoFrameNode = memo(({ id, data, selected }: NodeProps) => {
  void id
  const displayIndex = Number(data.displayIndex) || 1
  const previewUrl = data.previewUrl as string | null | undefined
  const hasVideo = Boolean(previewUrl)

  return (
    <div
      className={`ai-media-frame ai-video-frame ${selected ? 'ai-media-frame--selected' : ''}`}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Handle type="target" position={Position.Left} id="in" className="ai-flow-handle !bg-rose-400" />
      <Handle type="source" position={Position.Right} id="out" className="ai-flow-handle !bg-rose-400" />

      <button
        type="button"
        className="ai-image-frame-upload titlebar-no-drag"
        title="上传视频"
        onClick={(e) => {
          e.stopPropagation()
          notify.info('视频上传即将推出')
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
      </button>

      <div className="ai-media-frame-header">
        <span className="ai-media-frame-icon ai-video-icon" aria-hidden>
          ▶
        </span>
        <span className="ai-media-frame-title">视频节点 {displayIndex}</span>
      </div>

      <div className="ai-video-frame-preview">
        {hasVideo ? (
          <video src={previewUrl!} className="ai-video-frame-player" controls muted playsInline />
        ) : (
          <div className="ai-video-frame-placeholder">
            <div className="ai-video-play-ring">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        <div className="ai-image-frame-actions titlebar-no-drag">
          <span className="ai-video-try-label">尝试:</span>
          <button
            type="button"
            className="ai-image-pill"
            onClick={(e) => {
              e.stopPropagation()
              notify.info('首尾帧生成视频即将推出')
            }}
          >
            首尾帧生成视频
          </button>
          <button
            type="button"
            className="ai-image-pill"
            onClick={(e) => {
              e.stopPropagation()
              notify.info('首帧生成视频即将推出')
            }}
          >
            首帧生成视频
          </button>
        </div>
      </div>
    </div>
  )
})
VideoFrameNode.displayName = 'VideoFrameNode'
