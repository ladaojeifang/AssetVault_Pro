import '@babylonjs/loaders/glTF'
import '@babylonjs/loaders/OBJ'
import '@babylonjs/loaders/STL'
import '@babylonjs/loaders/SPLAT'

import {
  Scene,
  SceneLoader,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  TransformNode,
  ArcRotateCamera,
  Tools,
  Engine,
  type AbstractMesh,
  type AnimationGroup
} from '@babylonjs/core'
import {
  ImportMeshAsync,
  type ISceneLoaderAsyncResult
} from '@babylonjs/core/Loading/sceneLoader'
import { FramingBehavior } from '@babylonjs/core/Behaviors/Cameras/framingBehavior'
import { FBXLoader } from 'babylonjs-fbx-loader'
import { parseModel3dFormat, type Model3dFormat, type ModelAnimationClipInfo } from '@/shared/model3dFormats'
import { i18n } from '../../i18n'
import {
  fileUrlToPath,
  toAppFileProtocolUrl as toAppModelProtocolUrl
} from '../appFileProtocolUrl'

export { parseModel3dFormat, type Model3dFormat }

export { fileUrlToPath, toAppModelProtocolUrl }

export const THUMB_SCENE_COLOR = new Color4(0.1, 0.11, 0.18, 1)
export const VIEWER_SCENE_COLOR = new Color4(0.08, 0.09, 0.12, 1)
/** Default fps for Babylon animation groups (glTF / FBX imports). */
export const MODEL_ANIMATION_FPS = 60

export function animationGroupDurationSeconds(group: AnimationGroup, fps = MODEL_ANIMATION_FPS): number {
  return Math.max(0, (group.to - group.from) / fps)
}

export function animationGroupTimeToFrame(group: AnimationGroup, seconds: number, fps = MODEL_ANIMATION_FPS): number {
  const frame = group.from + seconds * fps
  return Math.min(group.to, Math.max(group.from, frame))
}

export function animationGroupFrameToTime(group: AnimationGroup, frame: number, fps = MODEL_ANIMATION_FPS): number {
  return Math.max(0, (frame - group.from) / fps)
}

export function collectSceneAnimationClips(scene: Scene): ModelAnimationClipInfo[] {
  return scene.animationGroups.map((group, index) => ({
    name: group.name?.trim() || i18n.t('preview:model3d.animationName', { index: index + 1 }),
    durationSeconds: animationGroupDurationSeconds(group)
  }))
}

/** OBJ+MTL textures need longer than bare meshes; still capped so FBX cannot hang forever. */
const THUMB_SCENE_READY_MS = 12_000
const THUMB_MESH_LOAD_MS = 40_000

function withThumbTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), THUMB_MESH_LOAD_MS)
    })
  ])
}

let fbxLoaderRegistered = false

function ensureFbxLoader(): void {
  if (fbxLoaderRegistered) return
  SceneLoader.RegisterPlugin(new FBXLoader())
  fbxLoaderRegistered = true
}

export function parseModelFileUrl(fileUrl: string): { rootUrl: string; filename: string } {
  const url = new URL(fileUrl)
  const pathname = decodeURIComponent(url.pathname).replace(/\\/g, '/')
  const slash = pathname.lastIndexOf('/')
  const filename = pathname.slice(slash + 1)
  const dir = pathname.slice(0, slash + 1)
  return { rootUrl: `file://${dir}`, filename }
}

export function addDefaultLights(scene: Scene): void {
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.65
  const key = new DirectionalLight('key', new Vector3(0.55, -0.75, 0.65), scene)
  key.intensity = 1.05
  const fill = new DirectionalLight('fill', new Vector3(-0.6, -0.25, -0.55), scene)
  fill.intensity = 0.38
  fill.diffuse = new Color3(0.55, 0.71, 1)
  const rim = new DirectionalLight('rim', new Vector3(0, 0.5, -1), scene)
  rim.intensity = 0.25
}

async function resolveModelBytes(
  fileUrl: string,
  fileBytes?: ArrayBufferView,
  libraryPath?: string
): Promise<ArrayBufferView | undefined> {
  if (fileBytes) return fileBytes
  if (!fileUrl.startsWith('file:')) return undefined
  const path = libraryPath ?? fileUrlToPath(fileUrl)
  if (typeof window !== 'undefined' && window.assetVaultAPI?.fs?.readFileBytes) {
    return window.assetVaultAPI.fs.readFileBytes(path)
  }
  return undefined
}

function objectUrlFromBytes(bytes: ArrayBufferView): string {
  const view =
    bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return URL.createObjectURL(new Blob([view]))
}

function meshHasVertices(mesh: AbstractMesh): boolean {
  mesh.refreshBoundingInfo(true)
  if (mesh.getTotalVertices() > 0) return true
  return (mesh.geometry?.getTotalVertices() ?? 0) > 0
}

function collectVisibleMeshes(result: ISceneLoaderAsyncResult, scene: Scene): AbstractMesh[] {
  const withVerts = (list: AbstractMesh[]) => list.filter(meshHasVertices)
  let meshes = withVerts(result.meshes)
  if (meshes.length > 0) return meshes
  meshes = withVerts(scene.meshes)
  return meshes
}

async function waitSceneReady(scene: Scene, forThumbnail: boolean): Promise<void> {
  if (!forThumbnail) {
    await scene.whenReadyAsync()
    return
  }
  await Promise.race([
    scene.whenReadyAsync(),
    new Promise<void>((resolve) => setTimeout(resolve, THUMB_SCENE_READY_MS))
  ])
}

/**
 * Load via URL (never ArrayBuffer). rootUrl must stay empty when source is a full URL,
 * otherwise Babylon concatenates paths or feeds ArrayBuffer to plugins that reject it (FBX).
 */
async function importFromModelUrl(
  scene: Scene,
  modelUrl: string,
  format: Model3dFormat,
  filename: string
): Promise<ISceneLoaderAsyncResult> {
  if (format === 'fbx') ensureFbxLoader()
  return ImportMeshAsync(modelUrl, scene, {
    pluginExtension: `.${format}`,
    name: filename,
    rootUrl: ''
  })
}

async function importMeshesFromBytes(
  scene: Scene,
  bytes: ArrayBufferView,
  format: Model3dFormat,
  filename: string
): Promise<ISceneLoaderAsyncResult> {
  const objectUrl = objectUrlFromBytes(bytes)
  try {
    return await importFromModelUrl(scene, objectUrl, format, filename)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function loadModelMeshes(
  scene: Scene,
  fileUrl: string,
  format: Model3dFormat,
  options?: { fileBytes?: ArrayBufferView; libraryPath?: string; thumbnail?: boolean }
): Promise<AbstractMesh[]> {
  const { filename } = parseModelFileUrl(fileUrl)
  const forThumb = options?.thumbnail === true
  let result: ISceneLoaderAsyncResult

  const loadMeshes = async (): Promise<ISceneLoaderAsyncResult> => {
    // FBX / PLY: protocol fetch can hang without rejecting; read bytes via IPC when possible.
    if ((format === 'fbx' || format === 'ply') && options?.libraryPath) {
      const bytes = await resolveModelBytes(fileUrl, options?.fileBytes, options.libraryPath)
      if (bytes && bytes.byteLength > 0) {
        return await importMeshesFromBytes(scene, bytes, format, filename)
      }
    }
    if (fileUrl.startsWith('file:')) {
      try {
        return await importFromModelUrl(scene, toAppModelProtocolUrl(fileUrl), format, filename)
      } catch (protocolErr) {
        const bytes = await resolveModelBytes(fileUrl, options?.fileBytes, options?.libraryPath)
        if (!bytes) throw protocolErr
        return await importMeshesFromBytes(scene, bytes, format, filename)
      }
    }
    const bytes = await resolveModelBytes(fileUrl, options?.fileBytes, options?.libraryPath)
    if (bytes) {
      return await importMeshesFromBytes(scene, bytes, format, filename)
    }
    const { rootUrl } = parseModelFileUrl(fileUrl)
    return SceneLoader.ImportMeshAsync('', rootUrl, filename, scene)
  }

  result = forThumb ? await withThumbTimeout(loadMeshes(), 'mesh load') : await loadMeshes()

  await waitSceneReady(scene, forThumb)
  const meshes = collectVisibleMeshes(result, scene)
  if (meshes.length === 0) throw new Error(i18n.t('preview:model3d.noVisibleMesh'))
  return meshes
}

export function centerMeshes(meshes: AbstractMesh[], scene: Scene): TransformNode {
  const pivot = new TransformNode('modelPivot', scene)
  const meshSet = new Set(meshes)

  for (const mesh of meshes) {
    const parent = mesh.parent
    if (!parent || !meshSet.has(parent as AbstractMesh)) {
      mesh.setParent(pivot)
    }
  }

  pivot.computeWorldMatrix(true)

  let min = new Vector3(Infinity, Infinity, Infinity)
  let max = new Vector3(-Infinity, -Infinity, -Infinity)

  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true)
    const bi = mesh.getBoundingInfo()
    if (!bi) continue
    min = Vector3.Minimize(min, bi.boundingBox.minimumWorld)
    max = Vector3.Maximize(max, bi.boundingBox.maximumWorld)
  }

  if (min.x !== Infinity) {
    const center = min.add(max).scale(0.5)
    pivot.position.subtractInPlace(center)
  }

  return pivot
}

export function frameArcCamera(camera: ArcRotateCamera, meshes: AbstractMesh[], margin = 1.35): void {
  const behavior = new FramingBehavior()
  behavior.framingTime = 0
  behavior.radiusScale = margin
  camera.addBehavior(behavior)
  behavior.zoomOnMeshesHierarchy(meshes)
}

export async function renderModelSnapshot(
  fileUrl: string,
  ext: string,
  size = 512,
  _fileBytes?: ArrayBufferView,
  libraryPath?: string
): Promise<string> {
  const format = parseModel3dFormat(ext)
  if (!format) throw new Error(`Unsupported 3D extension: ${ext}`)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    antialias: true
  })

  const scene = new Scene(engine)
  scene.clearColor = THUMB_SCENE_COLOR
  addDefaultLights(scene)

  const camera = new ArcRotateCamera(
    'thumbCam',
    Math.PI / 4,
    Math.PI / 2.4,
    10,
    Vector3.Zero(),
    scene
  )

  engine.runRenderLoop(() => {
    scene.render()
  })

  try {
    const meshes = await loadModelMeshes(scene, fileUrl, format, {
      thumbnail: true,
      libraryPath
    })
    centerMeshes(meshes, scene)
    frameArcCamera(camera, meshes)
    await waitSceneReady(scene, true)
    for (let i = 0; i < 5; i++) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    }
    return await Tools.CreateScreenshotAsync(engine, camera, { width: size, height: size })
  } finally {
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
  }
}
