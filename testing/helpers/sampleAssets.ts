import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** 1×1 red PNG — valid minimal image for import / thumbnail tests */
export const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export function writeSamplePng(filePath: string): void {
  writeFileSync(filePath, Buffer.from(PNG_1X1_BASE64, 'base64'))
}

/** Write a sample PNG outside any library root (avoids archive hardlink + delete races on Windows). */
export function writeTempSamplePng(name = 'sample.png'): string {
  const dir = mkdtempSync(join(tmpdir(), 'av-sample-'))
  const filePath = join(dir, name)
  writeSamplePng(filePath)
  return filePath
}
