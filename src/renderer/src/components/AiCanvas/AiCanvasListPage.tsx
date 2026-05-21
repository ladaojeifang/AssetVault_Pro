import React, { useCallback, useEffect, useState } from 'react'
import type { AiCanvasListItem } from '../../../../shared/aiCanvasTypes'
import { useAiCanvasNav } from '../../stores/AiCanvasNavContext'
import { notify } from '../Common/notify'

const AiCanvasListPage: React.FC = () => {
  const { openCanvasEditor, backToLibrary } = useAiCanvasNav()
  const [items, setItems] = useState<AiCanvasListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.assetVaultAPI.aiCanvas.list()
      setItems(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleCreate = async () => {
    const name = `画布 ${new Date().toLocaleDateString('zh-CN')}`
    setCreating(true)
    try {
      const doc = await window.assetVaultAPI.aiCanvas.create(name)
      openCanvasEditor(doc.id)
    } catch (e) {
      notify.error('创建失败')
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('删除此画布？不可恢复。')) return
    await window.assetVaultAPI.aiCanvas.delete(id)
    void refresh()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-av-bg-primary">
      <div className="flex items-center justify-between px-6 py-4 border-b border-av-border">
        <div>
          <button type="button" className="btn-ghost text-xs mb-2" onClick={backToLibrary}>
            ← 返回资源库
          </button>
          <h1 className="text-lg font-semibold text-av-text-primary">AI 画布</h1>
          <p className="text-xs text-av-text-secondary mt-1">
            节点编排提示词、参考图与生成任务；与「快速生成」并列的无限画布模式（原型）。
          </p>
        </div>
        <button type="button" className="btn-primary text-sm" disabled={creating} onClick={() => void handleCreate()}>
          {creating ? '创建中…' : '新建画布'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && <p className="text-sm text-av-text-secondary">加载中…</p>}
        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-av-border p-12 text-center">
            <p className="text-av-text-secondary text-sm mb-4">还没有画布</p>
            <button type="button" className="btn-primary" onClick={() => void handleCreate()}>
              创建第一个画布
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="text-left rounded-xl border border-av-border bg-av-bg-secondary hover:border-blue-500/50 p-4 transition-colors group"
              onClick={() => openCanvasEditor(item.id)}
            >
              <div className="h-28 rounded-lg bg-gradient-to-br from-violet-900/40 via-av-bg-elevated to-cyan-900/30 mb-3 border border-av-border" />
              <h2 className="font-medium text-sm text-av-text-primary truncate">{item.name}</h2>
              <p className="text-[11px] text-av-text-secondary mt-1">
                {item.nodeCount} 个节点 · 更新 {new Date(item.updatedAt).toLocaleString('zh-CN')}
              </p>
              <span
                role="button"
                tabIndex={0}
                className="inline-block mt-2 text-[11px] text-red-400 opacity-0 group-hover:opacity-100"
                onClick={(e) => void handleDelete(item.id, e)}
                onKeyDown={() => {}}
              >
                删除
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AiCanvasListPage
