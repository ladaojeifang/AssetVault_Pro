import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['testing/integration/**/*.test.ts'],
    exclude: [],
    setupFiles: ['testing/helpers/vitestIntegrationSetup.ts'],
    testTimeout: 60_000,
    fileParallelism: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})
