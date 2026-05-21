import React, { useMemo } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { ModeConfigModelEntry, ModeConfigParam } from '../../../../shared/modeConfigTypes'
import {
  getEnabledReferModelOptions,
  getFooterParams
} from './modeConfigCatalog'

interface GenParamControlsProps {
  nodeId: string
  entry: ModeConfigModelEntry
  params: Record<string, string>
  nodes: Node[]
  edges: Edge[]
  onPatchParams: (patch: Record<string, string>) => void
  stop: (e: React.SyntheticEvent) => void
}

const GenParamControls: React.FC<GenParamControlsProps> = ({
  nodeId,
  entry,
  params,
  nodes,
  edges,
  onPatchParams,
  stop
}) => {
  const footerParams = useMemo(() => getFooterParams(entry), [entry])

  const renderParam = (p: ModeConfigParam) => {
    const value = params[p.name] ?? ''

    if (p.type === 'select' && p.options?.length) {
      return (
        <select
          key={p.name}
          className="ai-gen-unit-select ai-gen-unit-select--sm"
          title={p.name}
          value={value}
          onChange={(e) => onPatchParams({ [p.name]: e.target.value })}
          onPointerDown={stop}
        >
          {p.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.name}
            </option>
          ))}
        </select>
      )
    }

    if (p.type === 'radio' && p.name === 'referModel') {
      const enabled = getEnabledReferModelOptions(p, nodeId, nodes, edges)
      if (enabled.length === 0) return null
      const current = enabled.some((o) => o.value === value) ? value : enabled[0].value
      return (
        <select
          key={p.name}
          className="ai-gen-unit-select ai-gen-unit-select--sm"
          title="生成模式"
          value={current}
          onChange={(e) => onPatchParams({ referModel: e.target.value })}
          onPointerDown={stop}
        >
          {enabled.map((o) => (
            <option key={o.value} value={o.value}>
              {o.name}
            </option>
          ))}
        </select>
      )
    }

    if (p.type === 'switch') {
      const on = value === 'true' || value === '1'
      return (
        <label key={p.name} className="ai-gen-unit-switch" title={p.name} onPointerDown={stop}>
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => onPatchParams({ [p.name]: e.target.checked ? 'true' : 'false' })}
          />
          <span>{p.name}</span>
        </label>
      )
    }

    return null
  }

  return <>{footerParams.map(renderParam)}</>
}

export default GenParamControls
