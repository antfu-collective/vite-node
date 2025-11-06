import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
    testTimeout: process.env.CI ? 120_000 : 5_000,
    onConsoleLog(log) {
      if (log.includes('Port is already')) {
        return false
      }
    },
  },
  resolve: {
    alias: {
      'vite-node/server': fileURLToPath(new URL('./src/server.ts', import.meta.url)),
      'vite-node/package.json': fileURLToPath(new URL('./package.json', import.meta.url)),
      'vite-node': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
})
