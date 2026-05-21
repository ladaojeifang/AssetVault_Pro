import React, { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GenModality } from './genModes'
import { modalityLabel } from './genModes'
import type { GenNodeData } from './genNodeData'
import { useNodeGen } from './AiCanvasNodeGenContext'

const STATUS_TEXT: Record<string, string> = {
  draft: '就绪',
  queued: '排队',
  running: '生成中',
  success: '完成',
  failed: '失败'
}

type UnifiedGenNodeProps = NodeProps & { modality: GenModality }

const UnifiedGenNodeInner: React.FC<UnifiedGenNodeProps> = ({ id, data, selected, modality }) => {
  const { patchNode, runNode, translateTextResult, uploadImage, importImage } = useNodeGen()
  const d = data as unknown as GenNodeData

  const displayIndex = d.displayIndex ?? 1
  const status = d.status ?? 'draft'
  const progress = d.progress ?? 0
  const prompt = d.prompt ?? ''
  const previewUrl = d.previewUrl
  const content = d.content ?? ''
  const contentTranslated = d.contentTranslated ?? ''
  const translating = Boolean(d.translating)
  const hue = d.hue ?? 210
  const running = status === 'running' || status === 'queued'
  const imported = Boolean(d.imported)
  const importing = Boolean(d.importing)

  const title = `${modalityLabel(modality)}节点 ${displayIndex}`

  const patch = useCallback(
    (p: Partial<GenNodeData>) => patchNode(id, p as Record<string, unknown>),
    [id, patchNode]
  )

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div
      className={`ai-gen-unit ai-gen-unit--${modality} ${selected ? 'ai-gen-unit--selected' : ''}`}
      onDoubleClick={stop}
    >
      <Handle type="target" position={Position.Left} id="in" className="ai-flow-handle" />
      <Handle type="source" position={Position.Right} id="out" className="ai-flow-handle" />

      {modality === 'image' && (
        <button
          type="button"
          className="ai-gen-unit-upload titlebar-no-drag nodrag"
          title="上传参考图"
          onClick={(e) => {
            stop(e)
            uploadImage(id)
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        </button>
      )}

      <div className="ai-gen-unit-header">
        <span className="ai-gen-unit-title">{title}</span>
        <span className={`ai-gen-unit-status ai-gen-unit-status--${status}`}>
          {STATUS_TEXT[status] ?? status}
        </span>
      </div>

      {/* 上：生成结果 */}
      <div className="ai-gen-unit-preview nodrag">
        {modality === 'text' ? (
          content ? (
            <div className="ai-gen-unit-text-result">
              <p>{content}</p>
              {contentTranslated ? (
                <>
                  <hr className="ai-gen-unit-text-divider" />
                  <p className="ai-gen-unit-text-translated">{contentTranslated}</p>
                </>
              ) : null}
              {translating ? <p className="ai-gen-unit-text-translating">翻译中…</p> : null}
            </div>
          ) : (
            <div className="ai-gen-unit-empty">
              <span className="opacity-50">≡</span>
              <span>生成结果将显示在这里</span>
            </div>
          )
        ) : modality === 'video' ? (
          previewUrl ? (
            <video src={previewUrl} className="ai-gen-unit-media" controls muted playsInline />
          ) : (
            <div className="ai-gen-unit-empty ai-gen-unit-empty--video">
              <div className="ai-video-play-ring">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )
        ) : previewUrl ? (
          <img src={previewUrl} alt="" className="ai-gen-unit-media" draggable={false} />
        ) : (
          <div
            className="ai-gen-unit-empty"
            style={{
              background: `linear-gradient(145deg, hsl(${hue} 50% 28%), hsl(${(hue + 30) % 360} 40% 16%))`
            }}
          >
            <span>生成结果将显示在这里</span>
          </div>
        )}
        {running && (
          <div className="ai-gen-unit-progress">
            <div className="ai-gen-unit-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}
        {modality === 'image' && status === 'success' && previewUrl && (
          <div className="ai-gen-unit-preview-actions titlebar-no-drag">
            <button
              type="button"
              className="ai-image-pill"
              disabled={imported || importing}
              onClick={(e) => {
                stop(e)
                importImage(id)
              }}
            >
              {importing ? '入库中…' : imported ? '已入库' : '入库'}
            </button>
          </div>
        )}
      </div>

      {/* 中：提示词 */}
      <div className="ai-gen-unit-prompt-wrap nodrag">
        <textarea
          className="ai-gen-unit-prompt nowheel"
          rows={modality === 'text' ? 3 : 2}
          placeholder={
            modality === 'text'
              ? '写下你想讲的故事、场景或角色设定…'
              : modality === 'video'
                ? '描述你想要生成的画面内容，@ 引用素材'
                : '描述你想要生成的画面内容，按 / 呼出指令，@ 引用素材'
          }
          value={prompt}
          onPointerDown={stop}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') e.stopPropagation()
          }}
          onChange={(e) => patch({ prompt: e.target.value })}
        />
      </div>

      {/* 下：模型 / 分辨率 / 比例 / 批量 / 生成 */}
      <div className="ai-gen-unit-footer nodrag titlebar-no-drag">
        <div className="ai-gen-unit-footer-row">
          <select
            className="ai-gen-unit-select"
            value={d.modelLabel}
            onChange={(e) => patch({ modelLabel: e.target.value })}
          >
            {modality === 'text' && (
              <>
                <option value="GVLM 3.1">GVLM 3.1</option>
                <option value="AssetVault Mock">AssetVault Mock</option>
              </>
            )}
            {modality === 'video' && (
              <>
                <option value="Kling O1">Kling O1</option>
                <option value="AssetVault Mock">AssetVault Mock</option>
              </>
            )}
            {modality === 'image' && (
              <>
                <option value="Lib Nano Pro">Lib Nano Pro</option>
                <option value="AssetVault Mock">AssetVault Mock</option>
              </>
            )}
          </select>
          {modality !== 'text' && (
            <>
              <select
                className="ai-gen-unit-select ai-gen-unit-select--sm"
                value={d.resolution ?? '2K'}
                onChange={(e) => patch({ resolution: e.target.value })}
              >
                <option value="2K">2K</option>
                <option value="4K">4K</option>
                <option value="1K">1K</option>
              </select>
              <select
                className="ai-gen-unit-select ai-gen-unit-select--sm"
                value={d.aspect ?? '16:9'}
                onChange={(e) => patch({ aspect: e.target.value })}
              >
                <option value="16:9">16:9</option>
                <option value="1:1">1:1</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
              </select>
            </>
          )}
          {modality === 'video' && (
            <select
              className="ai-gen-unit-select ai-gen-unit-select--sm"
              title="时长"
              aria-label="时长"
              value={d.durationSec ?? 5}
              onChange={(e) => patch({ durationSec: Number(e.target.value) })}
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  {s}s
                </option>
              ))}
            </select>
          )}
          {modality === 'text' ? (
            <button
              type="button"
              className="ai-gen-unit-translate"
              title="将上方生成结果翻译为另一种语言"
              disabled={running || translating || !content.trim()}
              onClick={(e) => {
                stop(e)
                translateTextResult(id)
              }}
            >
              {translating ? '翻译中…' : '生成结果翻译'}
            </button>
          ) : (
            <select
              className="ai-gen-unit-select ai-gen-unit-select--xs"
              value={d.batchSize ?? 1}
              onChange={(e) => patch({ batchSize: Number(e.target.value) })}
            >
              {[1, 2, 4].map((n) => (
                <option key={n} value={n}>
                  {modality === 'video' ? `${n}个` : `${n}张`}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          type="button"
          className="ai-gen-unit-submit"
          disabled={running || !prompt.trim()}
          onClick={(e) => {
            stop(e)
            runNode(id)
          }}
          title="生成"
        >
          {running ? <span className="ai-gen-submit-spin" /> : '生成'}
        </button>
      </div>
    </div>
  )
}

export const TextGenNode = memo((p: NodeProps) => <UnifiedGenNodeInner {...p} modality="text" />)
TextGenNode.displayName = 'TextGenNode'

export const ImageGenNode = memo((p: NodeProps) => <UnifiedGenNodeInner {...p} modality="image" />)
ImageGenNode.displayName = 'ImageGenNode'

export const VideoGenNode = memo((p: NodeProps) => <UnifiedGenNodeInner {...p} modality="video" />)
VideoGenNode.displayName = 'VideoGenNode'

/** 兼容旧画布 output / reference */
export const LegacyImageNode = ImageGenNode
