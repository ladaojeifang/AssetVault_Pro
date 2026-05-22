import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  MeshBuilder,
  Color3,
  StandardMaterial,
  DynamicTexture,
  type AbstractMesh,
  type Material,
  type Mesh
} from '@babylonjs/core'
import {
  loadModelMeshes,
  centerMeshes,
  frameArcCamera,
  addDefaultLights,
  parseModel3dFormat,
  VIEWER_SCENE_COLOR,
  collectSceneAnimationClips,
  animationGroupDurationSeconds,
  animationGroupTimeToFrame,
  animationGroupFrameToTime
} from '../../utils/model3d/loadModel'
import type { ModelAnimationClipInfo } from '@/shared/model3dFormats'
import type { AnimationGroup } from '@babylonjs/core'

export type ModelPreviewControls = {
  resetCamera: () => void
}

export type ModelPreviewViewportProps = {
  fileUrl: string
  extension: string
  showGrid?: boolean
  wireframe?: boolean
  uvDebug?: boolean
  /** Animation clip index (when model has animation groups). */
  animationClipIndex?: number
  animationPlaying?: boolean
  animationLoop?: boolean
  /** Seek to time in seconds; change value to trigger seek. */
  animationSeekTime?: number | null
  className?: string
  onReady?: (controls: ModelPreviewControls) => void
  onError?: (message: string) => void
  onAnimationClipsLoaded?: (clips: ModelAnimationClipInfo[]) => void
  onAnimationTick?: (payload: { time: number; duration: number; playing: boolean }) => void
}

type DefaultView = {
  alpha: number
  beta: number
  radius: number
  target: Vector3
}

function modelBottomY(meshes: AbstractMesh[]): number {
  let minY = 0
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true)
    const bi = mesh.getBoundingInfo()
    if (bi) minY = Math.min(minY, bi.boundingBox.minimumWorld.y)
  }
  return minY
}

function modelFootprint(meshes: AbstractMesh[]): number {
  let maxSpan = 2
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true)
    const bi = mesh.getBoundingInfo()
    if (!bi) continue
    const size = bi.boundingBox.maximumWorld.subtract(bi.boundingBox.minimumWorld)
    maxSpan = Math.max(maxSpan, size.x, size.z)
  }
  return maxSpan * 2.2
}

function createGridPlane(scene: Scene, size: number, y: number): Mesh {
  const ground = MeshBuilder.CreateGround(
    'previewGrid',
    { width: size, height: size, subdivisions: 1 },
    scene
  )
  ground.position.y = y - 0.002
  const mat = new StandardMaterial('previewGridMat', scene)
  mat.diffuseColor = new Color3(0.12, 0.13, 0.18)
  mat.specularColor = Color3.Black()
  mat.alpha = 0.92
  ground.material = mat
  ground.isPickable = false
  ground.receiveShadows = false

  const divisions = Math.min(32, Math.max(8, Math.round(size / 2)))
  const step = size / divisions
  const half = size / 2
  const lines: Vector3[][] = []
  for (let i = 0; i <= divisions; i++) {
    const t = -half + i * step
    lines.push([new Vector3(t, y, -half), new Vector3(t, y, half)])
    lines.push([new Vector3(-half, y, t), new Vector3(half, y, t)])
  }
  const lineMesh = MeshBuilder.CreateLineSystem('previewGridLines', { lines }, scene)
  lineMesh.color = new Color3(0.38, 0.42, 0.52)
  lineMesh.isPickable = false
  lineMesh.parent = ground
  return ground
}

function createUvCheckerTexture(scene: Scene): DynamicTexture {
  const cellCount = 8
  const cellSize = 64
  const size = cellCount * cellSize
  const tex = new DynamicTexture('uvChecker', { width: size, height: size }, scene, false)
  const ctx = tex.getContext() as CanvasRenderingContext2D
  for (let y = 0; y < cellCount; y++) {
    for (let x = 0; x < cellCount; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#d1d5db' : '#374151'
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
    }
  }
  tex.update()
  return tex
}

function setWireframeOnMaterial(material: Material | null | undefined, enabled: boolean): void {
  if (!material) return
  if ('wireframe' in material) {
    ;(material as StandardMaterial).wireframe = enabled
  }
}

export function ModelPreviewViewport({
  fileUrl,
  extension,
  showGrid = false,
  wireframe = false,
  uvDebug = false,
  animationClipIndex = 0,
  animationPlaying = false,
  animationLoop = true,
  animationSeekTime = null,
  className = '',
  onReady,
  onError,
  onAnimationClipsLoaded,
  onAnimationTick
}: ModelPreviewViewportProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    engine: Engine
    scene: Scene
    camera: ArcRotateCamera
    meshes: AbstractMesh[]
    grid: Mesh | null
    originalMaterials: Map<AbstractMesh, Material | null>
    uvChecker: DynamicTexture | null
    uvMaterials: StandardMaterial[]
    defaultView: DefaultView | null
    activeAnimation: AnimationGroup | null
    tickObserver: { remove: () => void } | null
  } | null>(null)

  const lastSeekRef = useRef<number | null>(null)
  const onAnimationTickRef = useRef(onAnimationTick)
  const onAnimationClipsLoadedRef = useRef(onAnimationClipsLoaded)
  const onErrorRef = useRef(onError)
  onAnimationTickRef.current = onAnimationTick
  onAnimationClipsLoadedRef.current = onAnimationClipsLoaded
  onErrorRef.current = onError

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const resetCamera = useCallback(() => {
    const ctx = sceneRef.current
    if (!ctx?.defaultView) return
    const { alpha, beta, radius, target } = ctx.defaultView
    ctx.camera.alpha = alpha
    ctx.camera.beta = beta
    ctx.camera.radius = radius
    ctx.camera.setTarget(target.clone())
  }, [])

  useEffect(() => {
    onReady?.({ resetCamera })
  }, [onReady, resetCamera, ready])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const format = parseModel3dFormat(extension)
    if (!format) {
      const msg = '不支持的 3D 格式'
      setError(msg)
      setLoading(false)
      onErrorRef.current?.(msg)
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

    const camera = new ArcRotateCamera('modelPreviewCam', Math.PI / 4, Math.PI / 2.4, 10, Vector3.Zero(), scene)
    camera.attachControl(canvas, true)
    camera.wheelPrecision = 45
    camera.panningSensibility = 120
    camera.minZ = 0.01

    const originalMaterials = new Map<AbstractMesh, Material | null>()
    sceneRef.current = {
      engine,
      scene,
      camera,
      meshes: [],
      grid: null,
      originalMaterials,
      uvChecker: null,
      uvMaterials: [],
      defaultView: null,
      activeAnimation: null,
      tickObserver: null
    }

    const resize = () => engine.resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    void (async () => {
      try {
        const meshes = await loadModelMeshes(scene, fileUrl, format)
        if (cancelled) return
        centerMeshes(meshes, scene)
        frameArcCamera(camera, meshes, 1.45)
        sceneRef.current!.meshes = meshes
        for (const mesh of meshes) {
          originalMaterials.set(mesh, mesh.material ?? null)
        }
        sceneRef.current!.defaultView = {
          alpha: camera.alpha,
          beta: camera.beta,
          radius: camera.radius,
          target: camera.target.clone()
        }

        const clips = collectSceneAnimationClips(scene)
        if (clips.length > 0) {
          const idx = Math.min(Math.max(0, animationClipIndex), scene.animationGroups.length - 1)
          const active = scene.animationGroups[idx]
          sceneRef.current!.activeAnimation = active
          active.reset()
          active.goToFrame(active.from, false)

          sceneRef.current!.tickObserver = scene.onBeforeRenderObservable.add(() => {
            const group = sceneRef.current?.activeAnimation
            if (!group) return
            const time = animationGroupFrameToTime(group, group.getCurrentFrame())
            const duration = animationGroupDurationSeconds(group)
            onAnimationTickRef.current?.({ time, duration, playing: group.isPlaying })
          })

          onAnimationClipsLoadedRef.current?.(clips)
        }

        resize()
        setLoading(false)
        setReady(true)
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : '模型加载失败'
          setError(msg)
          setLoading(false)
          onErrorRef.current?.(msg)
        }
      }
    })()

    engine.runRenderLoop(() => {
      scene.render()
    })

    return () => {
      cancelled = true
      setReady(false)
      ro.disconnect()
      camera.detachControl()
      sceneRef.current?.tickObserver?.remove()
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
      sceneRef.current = null
      lastSeekRef.current = null
      if (canvas.parentElement === container) container.removeChild(canvas)
    }
  }, [fileUrl, extension, animationClipIndex])

  useEffect(() => {
    const ctx = sceneRef.current
    if (!ctx || !ready) return

    if (ctx.grid) {
      ctx.grid.dispose(false, true)
      ctx.grid = null
    }
    if (showGrid && ctx.meshes.length > 0) {
      const y = modelBottomY(ctx.meshes)
      const size = modelFootprint(ctx.meshes)
      ctx.grid = createGridPlane(ctx.scene, size, y)
    }
  }, [showGrid, ready])

  useEffect(() => {
    const ctx = sceneRef.current
    if (!ctx || !ready) return

    if (uvDebug) {
      if (!ctx.uvChecker) {
        ctx.uvChecker = createUvCheckerTexture(ctx.scene)
      }
      for (const mat of ctx.uvMaterials) mat.dispose()
      ctx.uvMaterials = []
      for (const mesh of ctx.meshes) {
        if (!ctx.originalMaterials.has(mesh)) {
          ctx.originalMaterials.set(mesh, mesh.material ?? null)
        }
        const mat = new StandardMaterial(`uvDebug-${mesh.id}`, ctx.scene)
        mat.diffuseTexture = ctx.uvChecker
        mat.specularColor = Color3.Black()
        mat.backFaceCulling = false
        mat.wireframe = wireframe
        mesh.material = mat
        ctx.uvMaterials.push(mat)
      }
      return
    }

    for (const mat of ctx.uvMaterials) mat.dispose()
    ctx.uvMaterials = []

    for (const mesh of ctx.meshes) {
      const original = ctx.originalMaterials.get(mesh)
      if (original !== undefined) mesh.material = original
      setWireframeOnMaterial(mesh.material, wireframe)
    }
  }, [uvDebug, wireframe, ready])

  useEffect(() => {
    const ctx = sceneRef.current
    if (!ctx || !ready || ctx.scene.animationGroups.length === 0) return

    const idx = Math.min(Math.max(0, animationClipIndex), ctx.scene.animationGroups.length - 1)
    const next = ctx.scene.animationGroups[idx]
    if (ctx.activeAnimation === next) return

    ctx.activeAnimation?.stop()
    ctx.activeAnimation = next
    next.reset()
    next.goToFrame(next.from, false)
    lastSeekRef.current = 0
    onAnimationTickRef.current?.({ time: 0, duration: animationGroupDurationSeconds(next), playing: false })
    if (animationPlaying) next.play(animationLoop)
  }, [animationClipIndex, ready, animationPlaying, animationLoop])

  useEffect(() => {
    const group = sceneRef.current?.activeAnimation
    if (!group || !ready) return
    if (animationPlaying) {
      group.play(animationLoop)
    } else {
      group.pause()
    }
  }, [animationPlaying, animationLoop, ready, animationClipIndex])

  useEffect(() => {
    if (animationSeekTime == null || !ready) return
    if (lastSeekRef.current === animationSeekTime) return
    lastSeekRef.current = animationSeekTime

    const group = sceneRef.current?.activeAnimation
    if (!group) return
    const frame = animationGroupTimeToFrame(group, animationSeekTime)
    group.goToFrame(frame, false)
    if (!animationPlaying) group.pause()
  }, [animationSeekTime, ready, animationPlaying])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[320px] bg-[#14161f] overflow-hidden ${className}`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50 z-10 pointer-events-none">
          加载模型…
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
