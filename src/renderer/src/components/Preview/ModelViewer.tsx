import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3
} from '@babylonjs/core'
import {
  loadModelMeshes,
  centerMeshes,
  frameArcCamera,
  addDefaultLights,
  parseModel3dFormat,
  VIEWER_SCENE_COLOR
} from '../../utils/model3d/loadModel'

type ModelViewerProps = {
  fileUrl: string
  extension: string
  className?: string
  interactive?: boolean
}

export function ModelViewer({
  fileUrl,
  extension,
  className = '',
  interactive = true
}: ModelViewerProps) {
  const { t } = useTranslation('preview')
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const format = parseModel3dFormat(extension)
    if (!format) {
      setError(t('model3d.unsupportedFormat'))
      setLoading(false)
      return
    }

    let cancelled = false
    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.outline = 'none'
    container.appendChild(canvas)

    const engine = new Engine(canvas, true, { antialias: true, stencil: true })
    const scene = new Scene(engine)
    scene.clearColor = VIEWER_SCENE_COLOR
    addDefaultLights(scene)

    const camera = new ArcRotateCamera(
      'previewCam',
      Math.PI / 4,
      Math.PI / 2.4,
      10,
      Vector3.Zero(),
      scene
    )
    if (interactive) {
      camera.attachControl(canvas, true)
      camera.wheelPrecision = 45
      camera.panningSensibility = 120
    }

    const resize = () => engine.resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    void (async () => {
      try {
        const meshes = await loadModelMeshes(scene, fileUrl, format)
        if (cancelled) return
        centerMeshes(meshes, scene)
        frameArcCamera(camera, meshes)
        resize()
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('model3d.loadFailed'))
          setLoading(false)
        }
      }
    })()

    engine.runRenderLoop(() => {
      scene.render()
    })

    return () => {
      cancelled = true
      ro.disconnect()
      camera.detachControl()
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
      if (canvas.parentElement === container) {
        container.removeChild(canvas)
      }
    }
  }, [fileUrl, extension, interactive, t])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[200px] bg-[#14161f] rounded-lg overflow-hidden ${className}`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50 z-10 pointer-events-none">
          {t('loadingModel')}
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400/90 px-4 text-center z-10 pointer-events-none">
          {error}
        </div>
      )}
    </div>
  )
}
