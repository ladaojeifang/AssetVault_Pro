import React from 'react'
import type { ImageDockValue } from './dockTypes'

interface ImageGeneratorDockProps {
  value: ImageDockValue
  onChange: (patch: Partial<ImageDockValue>) => void
  onSubmit: () => void
  running?: boolean
  creditCost?: number
}

const ImageGeneratorDock: React.FC<ImageGeneratorDockProps> = ({
  value,
  onChange,
  onSubmit,
  running = false,
  creditCost = 14
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="ai-gen-dock ai-gen-dock--image titlebar-no-drag pointer-events-auto">
      <div className="ai-gen-dock-tools">
        <button type="button" className="ai-gen-tool" title="风格（即将推出）">
          <span className="ai-gen-tool-icon">◇</span>
          <span>风格</span>
        </button>
        <button type="button" className="ai-gen-tool" title="标记（即将推出）">
          <span className="ai-gen-tool-icon">◎</span>
          <span>标记</span>
        </button>
        <button type="button" className="ai-gen-tool" title="比例">
          <span className="ai-gen-tool-icon">▭</span>
          <span>比例</span>
        </button>
      </div>

      <textarea
        className="ai-gen-dock-input"
        rows={2}
        placeholder="描述你想要生成的画面内容，按 / 呼出指令，@ 引用素材"
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
            <option value="Lib Nano Pro">Lib Nano Pro</option>
            <option value="AssetVault Mock">AssetVault Mock</option>
          </select>
          <select
            className="ai-gen-select"
            value={value.aspect}
            onChange={(e) => onChange({ aspect: e.target.value })}
          >
            <option value="16:9 · 2K">16:9 · 2K</option>
            <option value="1:1 · 2K">1:1 · 2K</option>
            <option value="9:16 · 2K">9:16 · 2K</option>
          </select>
          <button type="button" className="ai-gen-chip" title="即将推出">
            摄像机控制
          </button>
        </div>
        <div className="ai-gen-dock-bar-right">
          <select
            className="ai-gen-select ai-gen-select--compact"
            value={value.batchSize}
            onChange={(e) => onChange({ batchSize: Number(e.target.value) })}
          >
            {[1, 2, 4].map((n) => (
              <option key={n} value={n}>
                {n}张
              </option>
            ))}
          </select>
          <span className="ai-gen-credits">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
            </svg>
            {creditCost * value.batchSize}
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

export default ImageGeneratorDock
