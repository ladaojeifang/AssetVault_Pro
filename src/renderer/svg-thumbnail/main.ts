type SvgThumbRenderPayload = {
  dataUrl: string
  size: number
  quality: number
}

declare global {
  interface Window {
    svgThumbHost: {
      onRenderRequest: (callback: (payload: SvgThumbRenderPayload) => void) => void
      sendResult: (result: { ok: boolean; dataUrl?: string; error?: string; ready?: boolean }) => void
    }
  }
}

const RENDER_TIMEOUT_MS = 5000

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('SVG image load failed'))
    img.src = dataUrl
  })
}

async function rasterizeSvgToWebpDataUrl(
  dataUrl: string,
  size: number,
  quality: number
): Promise<string> {
  const img = await Promise.race([
    loadImage(dataUrl),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('SVG render timeout')), RENDER_TIMEOUT_MS)
    })
  ])

  const naturalW = img.naturalWidth || size
  const naturalH = img.naturalHeight || size
  const scale = Math.min(size / naturalW, size / naturalH, 1)
  const drawW = Math.max(1, Math.round(naturalW * scale))
  const drawH = Math.max(1, Math.round(naturalH * scale))

  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  ctx.clearRect(0, 0, size, size)
  const dx = Math.floor((size - drawW) / 2)
  const dy = Math.floor((size - drawH) / 2)
  ctx.drawImage(img, dx, dy, drawW, drawH)

  const q = Math.min(1, Math.max(0.1, quality / 100))
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: q })
  if (!blob.size) throw new Error('empty webp blob')

  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:image/webp;base64,${btoa(binary)}`
}

window.svgThumbHost.onRenderRequest(async (payload) => {
  try {
    if (!payload.dataUrl.startsWith('data:image/svg+xml')) {
      throw new Error('invalid svg data url')
    }
    const size = Math.min(512, Math.max(64, Math.floor(payload.size || 256)))
    const quality = Math.min(100, Math.max(10, Math.floor(payload.quality || 80)))
    const dataUrl = await rasterizeSvgToWebpDataUrl(payload.dataUrl, size, quality)
    window.svgThumbHost.sendResult({ ok: true, dataUrl })
  } catch (err) {
    window.svgThumbHost.sendResult({
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    })
  }
})

window.svgThumbHost.sendResult({ ok: true, ready: true })
