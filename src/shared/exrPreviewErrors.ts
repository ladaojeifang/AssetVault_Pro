export type ExrPreviewFailureReason = 'layer_missing' | 'decode_failed' | 'render_failed'

export function formatExrPreviewError(
  error: string | undefined,
  failureReason?: ExrPreviewFailureReason
): string {
  switch (failureReason) {
    case 'layer_missing':
      return '该图层在 EXR 中不存在，请选择其它图层。'
    case 'decode_failed':
      return error?.trim() ? error : '图层解码失败，请尝试其它图层或 RGBA 合成预览。'
    case 'render_failed':
      return '预览编码失败，请稍后重试。'
    default:
      return error?.trim() || 'EXR 预览渲染失败'
  }
}
