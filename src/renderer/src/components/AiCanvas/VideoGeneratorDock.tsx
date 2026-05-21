import React from 'react'
import type { VideoDockTab, VideoDockValue } from './dockTypes'

const TABS: { id: VideoDockTab; label: string }[] = [
  { id: 'text2video', label: '文生视频' },
  { id: 'fullRef', label: '全图参考' },
  { id: 'img2video', label: '图生视频' },
  { id: 'firstFrame', label: '首帧' },
  { id: 'edit', label: '视频编辑' }
]

interface VideoGeneratorDockProps {
  value: VideoDockValue
  onChange: (patch: Partial<VideoDockValue>) => void
  onSubmit: () => void
  running?: boolean
  creditCost?: number
}

const VideoGeneratorDock: React.FC<VideoGeneratorDockProps> = ({
  value,
  onChange,
  onSubmit,
  running = false,
  creditCost = 35
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="ai-gen-dock ai-gen-dock--video titlebar-no-drag pointer-events-auto">
      <div className="ai-video-dock-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`ai-video-tab ${value.tab === tab.id ? 'ai-video-tab--active' : ''}`}
            onClick={() => onChange({ tab: tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ai-gen-dock-tools ai-gen-dock-tools--video">
        <button type="button" className="ai-gen-tool-square" title="标记">
          <span>标记</span>
        </button>
        <button type="button" className="ai-gen-tool-square" title="特效">
          <span>特效</span>
        </button>
        <button type="button" className="ai-gen-tool-square" title="主体">
          <span>+ 主体</span>
        </button>
      </div>

      <textarea
        className="ai-gen-dock-input"
        rows={2}
        placeholder="描述你想要生成的画面内容，@ 引用素材"
        value={value.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        onKeyDown={handleKeyDown}
      />

      <div className="ai-gen-dock-bar">
        <div className="ai-gen-dock-bar-left">
          <select
            className="ai-gen-select"
            value={value.modelLabel}
            onChange={(e) => onChange({ modelLabel: e.target.value })}
          >
            <option value="Kling O1">Kling O1</option>
            <option value="AssetVault Mock">AssetVault Mock</option>
          </select>
          <select
            className="ai-gen-select"
            value={value.settings}
            onChange={(e) => onChange({ settings: e.target.value })}
          >
            <option value="16:9 · 标准 · 5s">16:9 · 标准 · 5s</option>
            <option value="9:16 · 标准 · 5s">9:16 · 标准 · 5s</option>
            <option value="1:1 · 高清 · 10s">1:1 · 高清 · 10s</option>
          </select>
        </div>
        <div className="ai-gen-dock-bar-right">
          <button type="button" className="ai-gen-icon-btn" title="翻译">
            文/A
          </button>
          <select
            className="ai-gen-select ai-gen-select--compact"
            value={value.batchCount}
            onChange={(e) => onChange({ batchCount: Number(e.target.value) })}
          >
            {[1, 2].map((n) => (
              <option key={n} value={n}>
                {n}个
              </option>
            ))}
          </select>
          <span className="ai-gen-credits">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
            </svg>
            {creditCost * value.batchCount}
          </span>
          <button
            type="button"
            className="ai-gen-submit"
            disabled={running || !value.prompt.trim()}
            onClick={onSubmit}
            title="生成 (Ctrl+Enter)"
          >
            {running ? (
              <span className="ai-gen-submit-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default VideoGeneratorDock
