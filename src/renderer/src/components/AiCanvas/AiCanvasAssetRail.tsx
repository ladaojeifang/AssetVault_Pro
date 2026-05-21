import React, { useCallback, useEffect, useState } from 'react'
import type { AssetItem } from '@/shared/types'
import { notify } from '../Common/notify'

const RAIL_PAGE = 48

const AiCanvasAssetRail: React.FC = () => {
  const [items, setItems] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.assetVaultAPI.assets.query({
        page: 1,
        pageSize: RAIL_PAGE,
        sortBy: 'importedAt',
        sortOrder: 'desc'
      })
      setItems(result.items as AssetItem[])
    } catch (e) {
      console.error(e)
      notify.error('加载素材失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next: Record<string, string> = {}
      for (const a of items) {
        try {
          const url = await window.assetVaultAPI.assets.getThumbnail(a.id)
          if (url) next[a.id] = url
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setThumbs(next)
    })()
    return () => {
      cancelled = true
    }
  }, [items])

  const onDragStart = (e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.effectAllowed = 'copy'
    try {
      e.dataTransfer.setData('text/plain', asset.filename || 'asset')
      e.dataTransfer.setData('application/x-assetvault-asset-id', asset.id)
      e.dataTransfer.setData(
        'application/x-assetvault-drag',
        JSON.stringify({ assetIds: [asset.id] })
      )
    } catch {
      /* platform limits */
    }
  }

  if (collapsed) {
    return (
      <div className="w-9 border-r border-av-border bg-av-bg-secondary flex flex-col items-center py-2 shrink-0">
        <button
          type="button"
          className="btn-ghost p-1 text-[10px] writing-mode-vertical"
          title="展开素材库"
          onClick={() => setCollapsed(false)}
        >
          素材
        </button>
      </div>
    )
  }

  return (
    <aside className="w-[200px] border-r border-av-border bg-av-bg-secondary flex flex-col shrink-0">
      <div className="flex items-center justify-between px-2 py-2 border-b border-av-border">
        <span className="text-xs font-medium text-av-text-secondary">素材库</span>
        <div className="flex gap-1">
          <button type="button" className="btn-ghost text-[10px] px-1" onClick={() => void load()} title="刷新">
            ↻
          </button>
          <button type="button" className="btn-ghost text-[10px] px-1" onClick={() => setCollapsed(true)} title="收起">
            ‹
          </button>
        </div>
      </div>
      <p className="px-2 py-1 text-[10px] text-av-text-secondary leading-snug">
        拖到画布创建「图片素材」节点
      </p>
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1.5 content-start">
        {loading && <p className="col-span-2 text-[10px] text-av-text-secondary">加载中…</p>}
        {!loading && items.length === 0 && (
          <p className="col-span-2 text-[10px] text-av-text-secondary">暂无素材</p>
        )}
        {items.map((asset) => (
          <div
            key={asset.id}
            draggable
            onDragStart={(e) => onDragStart(e, asset)}
            className="rounded border border-av-border bg-av-bg-primary overflow-hidden cursor-grab active:cursor-grabbing hover:border-blue-500/50"
            title={asset.originalName || asset.filename}
          >
            <div className="aspect-square bg-av-bg-elevated flex items-center justify-center">
              {thumbs[asset.id] ? (
                <img src={thumbs[asset.id]} alt="" className="w-full h-full object-cover" draggable={false} />
              ) : (
                <span className="text-[9px] text-av-text-muted uppercase">{asset.extension}</span>
              )}
            </div>
            <p className="text-[9px] px-1 py-0.5 truncate text-av-text-secondary">
              {asset.originalName || asset.filename}
            </p>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default AiCanvasAssetRail
