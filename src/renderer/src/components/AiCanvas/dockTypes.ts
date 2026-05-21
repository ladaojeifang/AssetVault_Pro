import type { GenModality } from './genModes'

export interface ImageDockValue {
  prompt: string
  modelLabel: string
  aspect: string
  batchSize: number
}

export interface TextDockValue {
  prompt: string
  modelLabel: string
}

export type VideoDockTab = 'text2video' | 'fullRef' | 'img2video' | 'firstFrame' | 'edit'

export interface VideoDockValue {
  prompt: string
  modelLabel: string
  settings: string
  tab: VideoDockTab
  batchCount: number
}

export interface DockSubmitPayload {
  modality: GenModality
  image?: ImageDockValue
  text?: TextDockValue
  video?: VideoDockValue
}
