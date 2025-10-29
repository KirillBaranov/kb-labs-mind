import { defineConfig } from 'tsup'
import nodePreset from '@kb-labs/devkit/tsup/node.js'

export default defineConfig({
  ...nodePreset,
  entry: {
    index: 'src/index.ts',
  },
  external: ['@kb-labs/mind-types'],
  dts: {
    resolve: true,
  },
})
