import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'server': 'src/server.ts',
    'types': 'src/types.ts',
    'client': 'src/client.ts',
    'utils': 'src/utils.ts',
    'cli': 'src/cli.ts',
    'constants': 'src/constants.ts',
    'hmr': 'src/hmr/index.ts',
    'source-map': 'src/source-map.ts',
  },
  exports: true,
})
