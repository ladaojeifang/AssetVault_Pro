import React from 'react'
import type { TextDockValue } from './dockTypes'

interface TextGeneratorDockProps {
  value: TextDockValue
  onChange: (patch: Partial<TextDockValue>) => void
  onSubmit: () => void
  running?: boolean
  creditCost?: number
}

const TextGeneratorDock: React.FC<TextGeneratorDockProps> = ({
  value,
  onChange,
  onSubmit,
  running = false,
  creditCost = 6
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="ai-gen-dock ai-gen-dock--text titlebar-no-drag pointer-events-auto">
      <textarea
        className="ai-gen-dock-input ai-gen-dock-input--tall"
        rows={3}
        placeholder="写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看星星。"
        value={value.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        onKeyDown={handleKeyDown}
      />

      <div className="ai-gen-dock-bar">
        <div className="ai-gen-dock-bar-left">
          <select
            className="ai-gen-select ai-gen-select--model"
            value={value.modelLabel}
            onChange={(e) => onChange({ modelLabel: e.target.value })}
          >
            <option value="GVLM 3.1">GVLM 3.1</option>
            <option value="AssetVault Mock">AssetVault Mock</option>
          </select>
        </div>
        <div className="ai-gen-dock-bar-right">
          <button type="button" className="ai-gen-icon-btn" title="翻译（即将推出）">
            文/A
          </button>
          <span className="ai-gen-credits">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
            </svg>
            {creditCost}
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

export default TextGeneratorDock
