/** modeconfig.json — 画布节点与模型能力配置（与 LibTV 对齐） */

export type ConfigNodeType =
  | 'BASE_TEXT'
  | 'BASE_IMAGE'
  | 'BASE_VIDEO'
  | 'BASE_AUDIO'
  | 'GENERATE_TEXT'
  | 'GENERATE_IMAGE'
  | 'GENERATE_VIDEO'
  | 'GENERATE_AUDIO'
  | 'GENERATE_STORYBOARD'

export type CanvasNodeType =
  | 'GENERATE_TEXT'
  | 'GENERATE_IMAGE'
  | 'GENERATE_VIDEO'
  | 'GENERATE_AUDIO'
  | 'GENERATE_STORYBOARD'

export interface ModeConfigDependRule {
  type: string
  field: string
  inValues: string[]
  eqValue: unknown
  betweenValue: unknown
  length: string
}

export interface ModeConfigParamOption {
  name: string
  value: string
  dependOn: ModeConfigDependRule[]
}

export interface ModeConfigParam {
  advanced: unknown
  name: string
  length: string | null
  type: 'text' | 'select' | 'radio' | 'switch' | string
  default: string | null
  options?: ModeConfigParamOption[]
}

export interface ModeConfigAllowNodeType {
  codes: ConfigNodeType[]
  length: string
  allTextLength: string | null
}

export interface ModeConfigModelEntry {
  nodeType: CanvasNodeType
  allowInputNodeTypes: ConfigNodeType[]
  modelName: string
  modelCode: string
  modelIntroductionZh?: string
  modelIntroductionEn?: string
  sort: number
  modelConfig: {
    allowNodeType: ModeConfigAllowNodeType[]
    params: ModeConfigParam[]
  }
  restricted: boolean
}

export interface ModeConfigGroup {
  canvasNodeType: CanvasNodeType
  nodeConfig: ModeConfigModelEntry[]
}

export interface ModeConfigResponse {
  success: boolean
  errCode: string | null
  errMessage: string | null
  data: ModeConfigGroup[]
}
