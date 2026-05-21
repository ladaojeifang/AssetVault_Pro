import React, { memo, useCallback, useEffect, useMemo } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import type { CanvasNodeType } from '../../../../shared/modeConfigTypes'
import type { GenNodeData } from './genNodeData'
import { applyModelToNodeData, getPromptFromData } from './genNodeData'
import {
  getModelEntry,
  getModelsForCanvas,
  isReferModelOptionEnabled
} from './modeConfigCatalog'
import { useNodeGen } from './AiCanvasNodeGenContext'
import GenParamControls from './GenParamControls'
import VideoPreviewPlayer from './VideoPreviewPlayer'

const STATUS_TEXT: Record<string, string> = {
  draft: '就绪',
  queued: '排队',
  running: '生成中',
  success: '完成',
  failed: '失败'
}

type GenerateNodeProps = NodeProps & { canvasNodeType: CanvasNodeType }

const GenerateNodeInner: React.FC<GenerateNodeProps> = ({ id, data, selected, canvasNodeType }) => {
  const { patchNode, runNode, translateTextResult, uploadImage, uploadVideo, importImage } = useNodeGen()
  const { getNodes, getEdges } = useReactFlow()
  const d = data as unknown as GenNodeData

  const displayIndex = d.displayIndex ?? 1
  const status = d.status ?? 'draft'
  const progress = d.progress ?? 0
  const params = d.params ?? {}
  const prompt = getPromptFromData(d)
  const previewUrl = d.previewUrl
  const content = d.content ?? ''
  const contentTranslated = d.contentTranslated ?? ''
  const translating = Boolean(d.translating)
  const hue = d.hue ?? 210
  const running = status === 'running' || status === 'queued'
  const imported = Boolean(d.imported)
  const importing = Boolean(d.importing)
  const modelCode = d.modelCode ?? ''
  const entry = useMemo(
    () => getModelEntry(canvasNodeType, modelCode) ?? getModelsForCanvas(canvasNodeType)[0],
    [canvasNodeType, modelCode]
  )

  const flowKind = canvasNodeType.replace('GENERATE_', '').toLowerCase()

  const titleLabel = useMemo(() => {
    switch (canvasNodeType) {
      case 'GENERATE_TEXT':
        return `文本生成 ${displayIndex}`
      case 'GENERATE_IMAGE':
        return `图片生成 ${displayIndex}`
      case 'GENERATE_VIDEO':
        return `视频生成 ${displayIndex}`
      case 'GENERATE_AUDIO':
        return `音频生成 ${displayIndex}`
      case 'GENERATE_STORYBOARD':
        return `分镜生成 ${displayIndex}`
      default:
        return `节点 ${displayIndex}`
    }
  }, [canvasNodeType, displayIndex])

  const patch = useCallback(
    (p: Partial<GenNodeData>) => patchNode(id, p as Record<string, unknown>),
    [id, patchNode]
  )

  const patchParams = useCallback(
    (updates: Record<string, string>) => patch({ params: { ...params, ...updates } }),
    [params, patch]
  )

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const nodes = getNodes()
  const edges = getEdges()

  useEffect(() => {
    if (!entry || canvasNodeType !== 'GENERATE_VIDEO') return
    const refer = entry.modelConfig.params.find((p) => p.name === 'referModel')
    if (!refer?.options) return
    const enabled = refer.options.filter((o) => isReferModelOptionEnabled(o, id, nodes, edges))
    if (enabled.length && !enabled.some((o) => o.value === params.referModel)) {
      patchParams({ referModel: enabled[0].value })
    }
  }, [edges, nodes, id, entry, canvasNodeType, params.referModel, patchParams])

  const onModelChange = (code: string) => {
    const next = applyModelToNodeData(
      { ...d, params },
      canvasNodeType,
      code
    )
    patch(next)
  }

  const models = getModelsForCanvas(canvasNodeType)
  const showTranslate = canvasNodeType === 'GENERATE_TEXT'
  const showImageUpload =
    canvasNodeType === 'GENERATE_IMAGE' || canvasNodeType === 'GENERATE_STORYBOARD'
  const showVideoUpload = canvasNodeType === 'GENERATE_VIDEO'
  const showImport =
    canvasNodeType === 'GENERATE_IMAGE' ||
    canvasNodeType === 'GENERATE_STORYBOARD'
  const isText = canvasNodeType === 'GENERATE_TEXT'
  const isVideo = canvasNodeType === 'GENERATE_VIDEO'
  const isAudio = canvasNodeType === 'GENERATE_AUDIO'

  return (
    <div
      className={`ai-gen-unit ai-gen-unit--${flowKind} ${selected ? 'ai-gen-unit--selected' : ''}`}
      onDoubleClick={stop}
    >
      <Handle type="target" position={Position.Left} id="in" className="ai-flow-handle" />
      <Handle type="source" position={Position.Right} id="out" className="ai-flow-handle" />

      {(showImageUpload || showVideoUpload) && (
        <button
          type="button"
          className="ai-gen-unit-upload titlebar-no-drag nodrag"
          title={showVideoUpload ? '上传参考视频' : '上传参考图'}
          onClick={(e) => {
            stop(e)
            if (showVideoUpload) uploadVideo(id)
            else uploadImage(id)
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {showVideoUpload ? (
              <>
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </>
            ) : (
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            )}
          </svg>
        </button>
      )}

      <div className="ai-gen-unit-header">
        <span className="ai-gen-unit-title">{titleLabel}</span>
        <span className={`ai-gen-unit-status ai-gen-unit-status--${status}`}>
          {STATUS_TEXT[status] ?? status}
        </span>
      </div>

      <div className="ai-gen-unit-preview nodrag">
        {isText ? (
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
        ) : isVideo ? (
          previewUrl ? (
            <VideoPreviewPlayer src={previewUrl} onPointerDownCapture={stop} />
          ) : (
            <div className="ai-gen-unit-empty ai-gen-unit-empty--video">
              <div className="ai-video-play-ring">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )
        ) : isAudio ? (
          previewUrl ? (
            <audio src={previewUrl} className="ai-gen-unit-media-audio" controls />
          ) : (
            <div className="ai-gen-unit-empty">音频结果将显示在这里</div>
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
        {showImport && status === 'success' && previewUrl && (
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

      <div className="ai-gen-unit-prompt-wrap nodrag">
        <textarea
          className="ai-gen-unit-prompt nowheel"
          rows={isText ? 3 : 2}
          placeholder={
            isText
              ? '写下你想讲的故事、场景或角色设定…'
              : '描述你想要生成的画面内容，可连接左侧素材节点作为参考'
          }
          value={prompt}
          onPointerDown={stop}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') e.stopPropagation()
          }}
          onChange={(e) => patchParams({ prompt: e.target.value })}
        />
      </div>

      <div className="ai-gen-unit-footer nodrag titlebar-no-drag">
        <div className="ai-gen-unit-footer-row">
          <select
            className="ai-gen-unit-select"
            value={modelCode}
            onChange={(e) => onModelChange(e.target.value)}
            onPointerDown={stop}
          >
            {models.map((m) => (
              <option key={m.modelCode} value={m.modelCode}>
                {m.modelName}
              </option>
            ))}
          </select>
          {entry ? (
            <GenParamControls
              nodeId={id}
              entry={entry}
              params={params}
              nodes={nodes}
              edges={edges}
              onPatchParams={patchParams}
              stop={stop}
            />
          ) : null}
          {showTranslate ? (
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
          ) : null}
        </div>
        <button
          type="button"
          className="ai-gen-unit-submit"
          disabled={running || (!prompt.trim() && canvasNodeType !== 'GENERATE_STORYBOARD')}
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

export const GenerateTextNode = memo((p: NodeProps) => (
  <GenerateNodeInner {...p} canvasNodeType="GENERATE_TEXT" />
))
GenerateTextNode.displayName = 'GenerateTextNode'

export const GenerateImageNode = memo((p: NodeProps) => (
  <GenerateNodeInner {...p} canvasNodeType="GENERATE_IMAGE" />
))
GenerateImageNode.displayName = 'GenerateImageNode'

export const GenerateVideoNode = memo((p: NodeProps) => (
  <GenerateNodeInner {...p} canvasNodeType="GENERATE_VIDEO" />
))
GenerateVideoNode.displayName = 'GenerateVideoNode'

export const GenerateAudioNode = memo((p: NodeProps) => (
  <GenerateNodeInner {...p} canvasNodeType="GENERATE_AUDIO" />
))
GenerateAudioNode.displayName = 'GenerateAudioNode'

export const GenerateStoryboardNode = memo((p: NodeProps) => (
  <GenerateNodeInner {...p} canvasNodeType="GENERATE_STORYBOARD" />
))
GenerateStoryboardNode.displayName = 'GenerateStoryboardNode'
