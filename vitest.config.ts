import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

const runIntegration = process.env.TEST_INTEGRATION === '1'

export default defineConfig({
  test: {
    include: [
      'testing/unit/**/*.test.ts',
      'testing/gen/**/*.test.ts',
      ...(runIntegration ? ['testing/integration/**/*.test.ts'] : [])
    ],
    exclude: runIntegration ? [] : ['testing/integration/**'],
    testTimeout: 60_000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})
