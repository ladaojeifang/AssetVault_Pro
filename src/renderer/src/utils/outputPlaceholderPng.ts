/** Mock / 占位输出：在渲染进程生成 PNG data URL */

export function renderOutputPlaceholderDataUrl(hue: number, size = 512): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const g = ctx.createLinearGradient(0, 0, size, size)
  g.addColorStop(0, `hsl(${hue} 60% 38%)`)
  g.addColorStop(1, `hsl(${(hue + 40) % 360} 50% 22%)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let i = 0; i < 6; i++) {
    ctx.fillRect((i * size) / 6, 0, 1, size)
  }

  return canvas.toDataURL('image/png')
}

export function dataUrlToPngBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(',')
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}
