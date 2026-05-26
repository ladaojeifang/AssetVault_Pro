import { app, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

/** App icon for taskbar / Alt+Tab (dev + packaged). */
export function resolveAppIcon(): Electron.NativeImage | undefined {
  const candidates: string[] = []

  if (app.isPackaged) {
    candidates.push(
      join(process.resourcesPath, 'app-icon.ico'),
      join(process.resourcesPath, 'icon.ico'),
      join(process.resourcesPath, 'resources', 'icon.ico'),
      join(process.resourcesPath, 'resources', 'icon.png')
    )
  } else {
    const root = join(__dirname, '../..')
    candidates.push(join(root, 'resources', 'icon.ico'), join(root, 'resources', 'icon.png'))
  }

  for (const p of candidates) {
    if (!existsSync(p)) continue
    const img = nativeImage.createFromPath(p)
    if (!img.isEmpty()) return img
  }
  return undefined
}
