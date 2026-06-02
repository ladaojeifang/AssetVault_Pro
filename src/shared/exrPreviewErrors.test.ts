import { describe, expect, it } from 'vitest'
import { formatExrPreviewError } from './exrPreviewErrors'

describe('formatExrPreviewError', () => {
  it('maps failure reasons to user-facing copy', () => {
    expect(formatExrPreviewError('x', 'layer_missing')).toContain('不存在')
    expect(formatExrPreviewError('', 'decode_failed')).toContain('解码失败')
    expect(formatExrPreviewError('', 'render_failed')).toContain('编码失败')
  })

  it('falls back to server error text', () => {
    expect(formatExrPreviewError('自定义错误')).toBe('自定义错误')
  })
})
