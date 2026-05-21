import React from 'react'
import type { GenModality } from './genModes'
import { modalityLabel } from './genModes'
import type { ImageDockValue, TextDockValue, VideoDockValue } from './dockTypes'
import ImageGeneratorDock from './ImageGeneratorDock'
import TextGeneratorDock from './TextGeneratorDock'
import VideoGeneratorDock from './VideoGeneratorDock'

interface AiCanvasGeneratorDockRouterProps {
  modality: GenModality
  image: ImageDockValue
  text: TextDockValue
  video: VideoDockValue
  onImageChange: (patch: Partial<ImageDockValue>) => void
  onTextChange: (patch: Partial<TextDockValue>) => void
  onVideoChange: (patch: Partial<VideoDockValue>) => void
  onSubmit: () => void
  running?: boolean
}

const AiCanvasGeneratorDockRouter: React.FC<AiCanvasGeneratorDockRouterProps> = (props) => {
  const { modality, onSubmit, running } = props

  return (
    <div className="ai-dock-router">
      <span className="ai-dock-modality-badge">{modalityLabel(modality)}生成器</span>
      {modality === 'text' && (
        <TextGeneratorDock
          value={props.text}
          onChange={props.onTextChange}
          onSubmit={onSubmit}
          running={running}
        />
      )}
      {modality === 'image' && (
        <ImageGeneratorDock
          value={props.image}
          onChange={props.onImageChange}
          onSubmit={onSubmit}
          running={running}
        />
      )}
      {modality === 'video' && (
        <VideoGeneratorDock
          value={props.video}
          onChange={props.onVideoChange}
          onSubmit={onSubmit}
          running={running}
        />
      )}
    </div>
  )
}

export default AiCanvasGeneratorDockRouter
