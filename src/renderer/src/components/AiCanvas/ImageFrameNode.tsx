import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useAiCanvasImageActions } from './AiCanvasImageActionsContext'
import { useAiCanvasImport } from './AiCanvasImportContext'

export type ImageFrameVariant = 'reference' | 'output'

type ImageFrameProps = NodeProps & { variant: ImageFrameVariant }

const ImageFrameInner: React.FC<ImageFrameProps> = ({ id, data, selected, variant }) => {
  const { uploadToNode, img2imgFromNode, inpaintFromNode } = useAiCanvasImageActions()
  const importToLibrary = useAiCanvasImport()

  const displayIndex = Number(data.displayIndex) || 1
  const previewUrl = data.previewUrl as string | null | undefined
  const hue = (data.hue as number) ?? 200
  const imported = Boolean(data.imported)
  const importing = Boolean(data.importing)

  const title = variant === 'output' ? `生成结果 ${displayIndex}` : `图片节点 ${displayIndex}`

  return (
    <div
      className={`ai-media-frame ai-image-frame ${selected ? 'ai-media-frame--selected' : ''}`}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {variant === 'reference' && (
        <Handle type="source" position={Position.Right} id="out" className="ai-flow-handle !bg-cyan-400" />
      )}
      {variant === 'output' && (
        <Handle type="target" position={Position.Left} id="in" className="ai-flow-handle !bg-emerald-400" />
      )}

      {variant === 'reference' && (
        <button
          type="button"
          className="ai-image-frame-upload titlebar-no-drag"
          title="上传图片"
          onClick={(e) => {
            e.stopPropagation()
            uploadToNode(id)
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        </button>
      )}

      <div className="ai-media-frame-header">
        <span className="ai-media-frame-icon" aria-hidden>
          🖼
        </span>
        <span className="ai-media-frame-title">{title}</span>
      </div>

      <div className="ai-image-frame-preview">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="ai-image-frame-img" draggable={false} />
        ) : (
          <div className="ai-image-frame-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span>拖入素材或上传</span>
          </div>
        )}

        {variant === 'output' && !previewUrl && (
          <div
            className="ai-image-frame-fallback"
            style={{
              background: `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 36) % 360} 45% 18%))`
            }}
          />
        )}

        <div className="ai-image-frame-actions titlebar-no-drag">
          {variant === 'reference' ? (
            <>
              <button
                type="button"
                className="ai-image-pill"
                onClick={(e) => {
                  e.stopPropagation()
                  img2imgFromNode(id)
                }}
              >
                图生图
              </button>
              <button
                type="button"
                className="ai-image-pill"
                onClick={(e) => {
                  e.stopPropagation()
                  inpaintFromNode(id)
                }}
              >
                图片高清
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ai-image-pill"
                disabled={imported || importing}
                onClick={(e) => {
                  e.stopPropagation()
                  importToLibrary(id)
                }}
              >
                {importing ? '入库中…' : imported ? '已入库' : '入库'}
              </button>
              <button
                type="button"
                className="ai-image-pill"
                onClick={(e) => {
                  e.stopPropagation()
                  img2imgFromNode(id)
                }}
              >
                图生图
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export const ReferenceImageNode = memo((props: NodeProps) => (
  <ImageFrameInner {...props} variant="reference" />
))
ReferenceImageNode.displayName = 'ReferenceImageNode'

export const OutputImageNode = memo((props: NodeProps) => (
  <ImageFrameInner {...props} variant="output" />
))
OutputImageNode.displayName = 'OutputImageNode'
