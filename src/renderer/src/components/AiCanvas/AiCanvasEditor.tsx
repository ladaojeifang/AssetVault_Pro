import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {

  ReactFlow,

  ReactFlowProvider,

  Background,

  Controls,

  addEdge,

  useEdgesState,

  useNodesState,

  useReactFlow,

  type Connection,

  type Edge,

  type Node,

  type OnMove

} from '@xyflow/react'

import '@xyflow/react/dist/style.css'

import type { AiCanvasDocument } from '../../../../shared/aiCanvasTypes'

import type { AssetItem } from '@/shared/types'

import { useAiCanvasNav } from '../../stores/AiCanvasNavContext'

import { notify } from '../Common/notify'

import { isAssetDragEvent, parseAssetDragPayload } from '../../utils/assetDragDrop'

import {

  buildBaseAssetNodesFromAssetIds,

  createEmptyBaseTextNode,

  hydrateReferencePreviewUrls,

  revokePreviewUrlIfBlob,

  revokePreviewUrlsFromNodes

} from '../../utils/canvasAssetNodes'

import { hydrateOutputPreviewUrls } from './hydrateOutputPreviews'

import { dataUrlToPngBase64, renderOutputPlaceholderDataUrl } from '../../utils/outputPlaceholderPng'

import {

  BaseAudioNode,

  BaseImageNode,

  BaseTextNode,

  BaseVideoNode,

  GenerateAudioNode,

  GenerateImageNode,

  GenerateStoryboardNode,

  GenerateTextNode,

  GenerateVideoNode

} from './aiCanvasNodes'

import type { FlowNodeType } from './canvasNodeTypes'

import {

  flowTypeToCanvasNodeType,

  isBaseFlowType,

  isGenerateFlowType

} from './canvasNodeTypes'

import { docToFlow, flowToDoc } from './docFlow'

import { migrateLoadedCanvas } from './migrateLoadedNodes'

import { AiCanvasNodeGenContext } from './AiCanvasNodeGenContext'
import { AiCanvasBaseAssetContext } from './AiCanvasBaseAssetContext'
import { useApp } from '../../stores/AppContext'
import { assetToNodePreview, pickAndImportLibraryAsset } from '../../utils/canvasAssetImport'

import { runNodeGenMock } from './runNodeGenMock'

import { runTextTranslateMock } from './runTextTranslateMock'

import { canConnectNodes } from './modeConfigCatalog'

import { canvasTypeFromNode, createFlowNodeId, defaultGenNodeDataForFlow } from './genNodeData'

import AiCanvasLeftToolbar from './AiCanvasLeftToolbar'



const nodeTypes = {

  base_text: BaseTextNode,

  base_image: BaseImageNode,

  base_video: BaseVideoNode,

  base_audio: BaseAudioNode,

  generate_text: GenerateTextNode,

  generate_image: GenerateImageNode,

  generate_video: GenerateVideoNode,

  generate_audio: GenerateAudioNode,

  generate_storyboard: GenerateStoryboardNode,

  text: GenerateTextNode,

  image: GenerateImageNode,

  video: GenerateVideoNode,

  reference: BaseImageNode,

  output: GenerateImageNode

}



interface AiCanvasEditorProps {
  canvasId: string
}



function nextIndex(nodes: Node[], type: string): number {

  return nodes.filter((n) => n.type === type).reduce((m, n) => Math.max(m, Number(n.data.displayIndex) || 0), 0) + 1

}



const AiCanvasEditorInner: React.FC<AiCanvasEditorProps> = ({ canvasId }) => {
  const { backToCanvasList } = useAiCanvasNav()
  const { refreshAssets } = useApp()
  const crossWindowDragRef = useRef(false)

  const { screenToFlowPosition } = useReactFlow()

  const [docMeta, setDocMeta] = useState<Pick<

    AiCanvasDocument,

    'id' | 'name' | 'createdAt' | 'updatedAt'

  > | null>(null)

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [dropActive, setDropActive] = useState(false)

  const initialViewport = useRef({ x: 0, y: 0, zoom: 1 })

  const viewportRef = useRef(initialViewport.current)



  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])

  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const nodesRef = useRef(nodes)

  nodesRef.current = nodes



  const save = useCallback(async () => {

    if (!docMeta) return

    setSaving(true)

    try {

      const payload = flowToDoc(docMeta, nodes, edges, viewportRef.current)

      const saved = await window.assetVaultAPI.aiCanvas.save(payload)

      setDocMeta({

        id: saved.id,

        name: saved.name,

        createdAt: saved.createdAt,

        updatedAt: saved.updatedAt

      })

      notify.success('画布已保存')

    } catch (e) {

      notify.error('保存失败')

      console.error(e)

    } finally {

      setSaving(false)

    }

  }, [docMeta, nodes, edges])



  const patchNode = useCallback(

    (nodeId: string, patch: Record<string, unknown>) => {

      setNodes((prev) =>

        prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))

      )

    },

    [setNodes]

  )



  const handleImportImage = useCallback(

    async (nodeId: string) => {

      if (!docMeta) return

      const node = nodes.find((n) => n.id === nodeId)

      if (!node) return

      if (node.data.imported) {

        notify.info('已入库')

        return

      }



      patchNode(nodeId, { importing: true })



      try {

        const hue = Number(node.data.hue) ?? 200

        const previewUrl =

          (node.data.previewUrl as string | undefined) || renderOutputPlaceholderDataUrl(hue, 512)

        const pngBase64 = dataUrlToPngBase64(previewUrl)

        const safeName = docMeta.name.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40)

        const result = await window.assetVaultAPI.aiCanvas.importOutput({

          pngBase64,

          filename: `canvas-${safeName}-${nodeId.slice(0, 8)}.png`,

          canvasId: docMeta.id,

          nodeId

        })

        if (!result?.assetId) {

          notify.error('入库失败')

          patchNode(nodeId, { importing: false })

          return

        }

        patchNode(nodeId, {

          importing: false,

          imported: true,

          assetId: result.assetId,

          previewUrl

        })

        notify.success('已加入资源库')

        void save()

      } catch (e) {

        console.error(e)

        notify.error('入库失败')

        patchNode(nodeId, { importing: false })

      }

    },

    [docMeta, nodes, patchNode, save]

  )



  const attachLibraryAssetToNode = useCallback(
    async (nodeId: string, kind: 'image' | 'video', mode: 'base' | 'generate') => {
      try {
        const asset = await pickAndImportLibraryAsset(kind)
        if (!asset) return

        const previewUrl = await assetToNodePreview(asset)
        const prev = nodes.find((n) => n.id === nodeId)
        revokePreviewUrlIfBlob(prev?.data.previewUrl as string | undefined)

        const patch: Record<string, unknown> = {
          previewUrl,
          assetId: asset.id,
          label: asset.originalName || asset.filename
        }
        if (mode === 'generate') patch.status = 'draft'

        patchNode(nodeId, patch)
        await refreshAssets()

        notify.success(
          mode === 'base'
            ? '已导入素材库并载入节点'
            : kind === 'video'
              ? '已载入参考视频，可编辑提示词后生成'
              : '已载入参考图，可编辑提示词后生成'
        )
      } catch (e) {
        console.error(e)
        notify.error('导入失败')
      }
    },
    [nodes, patchNode, refreshAssets]
  )

  const loadLocalImage = useCallback(
    (nodeId: string) => attachLibraryAssetToNode(nodeId, 'image', 'base'),
    [attachLibraryAssetToNode]
  )

  const loadLocalVideo = useCallback(
    (nodeId: string) => attachLibraryAssetToNode(nodeId, 'video', 'base'),
    [attachLibraryAssetToNode]
  )

  const uploadImage = useCallback(
    (nodeId: string) => attachLibraryAssetToNode(nodeId, 'image', 'generate'),
    [attachLibraryAssetToNode]
  )

  const uploadVideo = useCallback(
    (nodeId: string) => attachLibraryAssetToNode(nodeId, 'video', 'generate'),
    [attachLibraryAssetToNode]
  )



  const runNode = useCallback(

    (nodeId: string) => {

      void runNodeGenMock(nodeId, setNodes, setEdges)

    },

    [setNodes, setEdges]

  )



  const translateTextResult = useCallback(

    (nodeId: string) => {

      void runTextTranslateMock(nodeId, setNodes)

    },

    [setNodes]

  )



  const baseAssetActions = useMemo(
    () => ({
      loadLocalImage,
      loadLocalVideo
    }),
    [loadLocalImage, loadLocalVideo]
  )

  const nodeGenActions = useMemo(

    () => ({

      patchNode,

      runNode,

      translateTextResult,

      uploadImage,

      uploadVideo,

      importImage: handleImportImage

    }),

    [patchNode, runNode, translateTextResult, uploadImage, uploadVideo, handleImportImage]

  )



  useEffect(() => {

    let cancelled = false

    revokePreviewUrlsFromNodes(nodesRef.current)

    setNodes([])

    setEdges([])

    setLoading(true)

    void window.assetVaultAPI.aiCanvas.get(canvasId).then(async (doc) => {

      if (cancelled) return

      if (!doc) {

        notify.error('画布不存在')

        backToCanvasList()

        return

      }

      const { nodes: n, edges: e, viewport } = docToFlow(doc)

      let { nodes: hydrated, edges: loadedEdges } = migrateLoadedCanvas(n, e)

      hydrated = await hydrateReferencePreviewUrls(hydrated)

      hydrated = await hydrateOutputPreviewUrls(hydrated)

      initialViewport.current = viewport

      viewportRef.current = viewport

      setDocMeta({

        id: doc.id,

        name: doc.name,

        createdAt: doc.createdAt,

        updatedAt: doc.updatedAt

      })

      setNodes(hydrated)

      setEdges(loadedEdges)

      setLoading(false)

    })

    return () => {

      cancelled = true

      revokePreviewUrlsFromNodes(nodesRef.current)

    }

  }, [canvasId, backToCanvasList, setNodes, setEdges])



  const isValidConnection = useCallback(

    (conn: Connection | Edge) => {

      const source = nodes.find((n) => n.id === conn.source)

      const target = nodes.find((n) => n.id === conn.target)

      if (!source || !target) return false

      const targetCanvas = canvasTypeFromNode(target)

      const targetData = target.data as { modelCode?: string }

      return canConnectNodes(

        source.type,

        target.type,

        targetData.modelCode,

        targetCanvas

      )

    },

    [nodes]

  )



  const onConnect = useCallback(

    (conn: Connection) => {

      if (!isValidConnection(conn)) {

        notify.warning('该模型不允许此类型的连线')

        return

      }

      setEdges((eds) => addEdge({ ...conn, animated: true }, eds))

    },

    [setEdges, isValidConnection]

  )



  const onMoveEnd: OnMove = useCallback((_e, viewport) => {

    viewportRef.current = viewport

  }, [])



  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!isAssetDragEvent(e) && !crossWindowDragRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropActive(true)
  }, [])

  const onDragLeave = useCallback(() => setDropActive(false), [])

  const onDragEndCanvas = useCallback(() => setDropActive(false), [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      setDropActive(false)
      e.preventDefault()

      void (async () => {
        let assetIds: string[] = []
        const payload = parseAssetDragPayload(e)
        if (payload?.assetIds.length) {
          assetIds = payload.assetIds
        } else {
          const consumed = await window.assetVaultAPI.assetDrag.consume()
          if (consumed?.length) assetIds = consumed
        }
        if (!assetIds.length) return

        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        const { nodes: newNodes, skipped } = await buildBaseAssetNodesFromAssetIds(
          assetIds,
          position,
          nodes
        )
        if (newNodes.length === 0) {
          notify.warning(
            skipped > 0
              ? '所选素材类型不支持拖入画布（仅图片/视频/音频）'
              : '无法添加所选素材'
          )
          return
        }

        setNodes((prev) => [...prev, ...newNodes])
        const msg =
          skipped > 0
            ? `已添加 ${newNodes.length} 个素材节点（${skipped} 项已跳过）`
            : `已添加 ${newNodes.length} 个素材节点`
        notify.success(msg)
      })()
    },
    [screenToFlowPosition, nodes, setNodes]
  )

  useEffect(() => {
    const unsub = window.assetVaultAPI.assetDrag.onStateChange((state) => {
      crossWindowDragRef.current = state.active
      if (!state.active) setDropActive(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    const onDocDragOver = (e: DragEvent) => {
      if (!crossWindowDragRef.current) return
      e.preventDefault()
    }
    document.addEventListener('dragover', onDocDragOver)
    return () => document.removeEventListener('dragover', onDocDragOver)
  }, [])



  useEffect(() => {

    const onKey = (e: KeyboardEvent) => {

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {

        e.preventDefault()

        void save()

      }

    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)

  }, [save])



  const runningCount = useMemo(

    () => nodes.filter((n) => n.data.status === 'running' || n.data.status === 'queued').length,

    [nodes]

  )



  const selectedNodeCount = useMemo(() => nodes.filter((n) => n.selected).length, [nodes])



  const deleteSelectedNodes = useCallback(() => {

    const toRemove = nodes.filter((n) => n.selected)

    if (toRemove.length === 0) return

    revokePreviewUrlsFromNodes(toRemove)

    const removeIds = new Set(toRemove.map((n) => n.id))

    setNodes((prev) => prev.filter((n) => !removeIds.has(n.id)))

    setEdges((prev) => prev.filter((e) => !removeIds.has(e.source) && !removeIds.has(e.target)))

  }, [nodes, setNodes, setEdges])



  const addNodeCenter = useCallback(

    (flowType: FlowNodeType) => {

      const pos = screenToFlowPosition({

        x: window.innerWidth * 0.52,

        y: window.innerHeight * 0.42

      })



      if (isBaseFlowType(flowType)) {

        if (flowType === 'base_text') {

          setNodes((prev) => [

            ...prev,

            createEmptyBaseTextNode(pos, nextIndex(nodes, 'base_text'))

          ])

          return

        }

        setNodes((prev) => [

          ...prev,

          {

            id: createFlowNodeId(flowType),

            type: flowType,

            position: pos,

            data: { displayIndex: nextIndex(nodes, flowType), previewUrl: null, assetId: null, label: '' }

          }

        ])

        return

      }



      if (!isGenerateFlowType(flowType)) return

      const canvas = flowTypeToCanvasNodeType(flowType)

      if (!canvas) return



      const newNode: Node = {

        id: createFlowNodeId(flowType),

        type: flowType,

        position: pos,

        data: defaultGenNodeDataForFlow(flowType, nextIndex(nodes, flowType))

      }

      setNodes((prev) => [...prev, newNode])

    },

    [screenToFlowPosition, nodes, setNodes]

  )



  if (loading || !docMeta) {

    return (

      <div className="flex-1 flex items-center justify-center text-av-text-secondary text-sm">

        加载画布…

      </div>

    )

  }



  return (
    <div className="flex flex-1 flex-col overflow-hidden min-w-0">
      <div
        className={`flex-1 relative ai-canvas-flow ${dropActive ? 'ring-2 ring-inset ring-blue-500/40' : ''}`}
        onDragEnd={onDragEndCanvas}
      >

          <AiCanvasBaseAssetContext.Provider value={baseAssetActions}>
          <AiCanvasNodeGenContext.Provider value={nodeGenActions}>

            <ReactFlow

              nodes={nodes}

              edges={edges}

              onNodesChange={onNodesChange}

              onEdgesChange={onEdgesChange}

              onConnect={onConnect}

              isValidConnection={isValidConnection}

              onMoveEnd={onMoveEnd}

              onDragOver={onDragOver}

              onDragLeave={onDragLeave}

              onDrop={onDrop}

              nodeTypes={nodeTypes}

              deleteKeyCode={['Backspace', 'Delete']}

              defaultViewport={initialViewport.current}

              fitView

              minZoom={0.2}

              maxZoom={2}

              proOptions={{ hideAttribution: true }}

            >

              <Background gap={24} size={1} color="#1e2130" />

              <Controls

                position="bottom-left"

                className="!bg-av-bg-elevated/90 !border-av-border !shadow-lg"

              />

            </ReactFlow>



            <AiCanvasLeftToolbar

              onBack={backToCanvasList}

              onSave={() => void save()}

              onAddNode={addNodeCenter}

              onDeleteSelected={deleteSelectedNodes}

              selectedNodeCount={selectedNodeCount}

            />



            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none max-w-[min(90%,420px)]">

              <span className="px-3 py-1 rounded-full bg-av-bg-elevated/80 border border-av-border text-xs text-av-text-secondary truncate block">

                {docMeta.name}

                {saving ? ' · 保存中…' : ''}

                {runningCount > 0 ? ` · ${runningCount} 个生成中` : ''}

                {' · 可从资源库窗口拖入素材'}

              </span>

            </div>

          </AiCanvasNodeGenContext.Provider>
          </AiCanvasBaseAssetContext.Provider>
        </div>
    </div>
  )
}



const AiCanvasEditor: React.FC<AiCanvasEditorProps> = (props) => (

  <ReactFlowProvider>

    <AiCanvasEditorInner {...props} />

  </ReactFlowProvider>

)



export default AiCanvasEditor

