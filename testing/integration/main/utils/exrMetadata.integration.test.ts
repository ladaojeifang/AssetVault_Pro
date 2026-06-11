import { existsSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { resolveExrFileMetadata } from '@main/utils/exrMetadata'

const UNREAL_ENGINE_BAKE_EXR =
  'G:\\del_test\\items\\c1e95068-0c88-4db9-b9ba-326d806e7c32\\EP19_seq04_sc032_101_145_engineBake.0098.exr'

describe('Unreal engineBake EXR metadata', () => {
  it.skipIf(!existsSync(UNREAL_ENGINE_BAKE_EXR))(
    'resolves metadata when LONG_NAMES flag is set but names are null-terminated',
    async () => {
      const meta = await resolveExrFileMetadata(UNREAL_ENGINE_BAKE_EXR)
      expect(meta).not.toBeNull()
      expect(meta?.width).toBe(1920)
      expect(meta?.height).toBe(804)
      expect(meta?.layers.length).toBeGreaterThan(0)
      expect(meta?.probeSource).toBe('header')
    }
  )
})
