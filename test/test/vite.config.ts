import type { PluginOption } from 'vite'
import fs from 'node:fs/promises'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [dataLoader()],
})

// Plugin that transforms .data files into string exports
function dataLoader(): PluginOption {
  return {
    name: 'data-loader',
    async load(id) {
      if (id.endsWith('.data')) {
        const text = await fs.readFile(id, 'utf8')
        return `export const id = ${JSON.stringify(id)};\n`
          + `export const text = ${JSON.stringify(text)};`
      }
    },
  }
}
