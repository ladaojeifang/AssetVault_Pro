export {
  GenerateTextNode,
  GenerateImageNode,
  GenerateVideoNode,
  GenerateAudioNode,
  GenerateStoryboardNode
} from './GenerateNode'

export { BaseTextNode } from './BaseTextNode'
export { BaseImageNode } from './BaseImageNode'
export { BaseVideoNode } from './BaseVideoNode'
export { BaseAudioNode } from './BaseAssetNode'

/** 兼容旧类型名 */
export { GenerateImageNode as ImageGenNode, GenerateTextNode as TextGenNode, GenerateVideoNode as VideoGenNode } from './GenerateNode'
export { BaseImageNode as LegacyImageNode } from './BaseImageNode'
