import { app } from 'electron'
import { join } from 'path'
import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { AiCanvasDocument, AiCanvasListItem } from '../../shared/aiCanvasTypes'

function canvasesDir(): string {
  return join(app.getPath('userData'), 'ai-canvases')
}

function canvasPath(id: string): string {
  return join(canvasesDir(), `${id}.json`)
}

function defaultDocument(name: string): AiCanvasDocument {
  const id = uuidv4()
  const now = new Date().toISOString()
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: 'generate_image-1',
        type: 'generate_image',
        position: { x: 280, y: 120 },
        data: {
          displayIndex: 1,
          canvasNodeType: 'GENERATE_IMAGE',
          modelCode: 'BANANA_PRO',
          modelName: 'PixNano Pro',
          params: {
            prompt: '',
            resolution: '2K',
            aspectRatio: 'auto',
            count: '1'
          },
          status: 'draft',
          progress: 0,
          previewUrl: null
        }
      }
    ],
    edges: []
  }
}

async function ensureDir(): Promise<void> {
  const dir = canvasesDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

export async function listAiCanvases(): Promise<AiCanvasListItem[]> {
  await ensureDir()
  const files = await readdir(canvasesDir())
  const items: AiCanvasListItem[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = await readFile(join(canvasesDir(), file), 'utf-8')
      const doc = JSON.parse(raw) as AiCanvasDocument
      items.push({
        id: doc.id,
        name: doc.name,
        updatedAt: doc.updatedAt,
        nodeCount: doc.nodes?.length ?? 0
      })
    } catch {
      /* skip corrupt */
    }
  }
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return items
}

export async function getAiCanvas(id: string): Promise<AiCanvasDocument | null> {
  const path = canvasPath(id)
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as AiCanvasDocument
}

export async function createAiCanvas(name: string): Promise<AiCanvasDocument> {
  await ensureDir()
  const doc = defaultDocument(name.trim() || '未命名画布')
  await writeFile(canvasPath(doc.id), JSON.stringify(doc, null, 2), 'utf-8')
  return doc
}

export async function saveAiCanvas(doc: AiCanvasDocument): Promise<AiCanvasDocument> {
  await ensureDir()
  const updated: AiCanvasDocument = {
    ...doc,
    updatedAt: new Date().toISOString()
  }
  await writeFile(canvasPath(updated.id), JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}

export async function deleteAiCanvas(id: string): Promise<boolean> {
  const path = canvasPath(id)
  if (!existsSync(path)) return false
  await unlink(path)
  return true
}
