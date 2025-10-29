import { defineConfig } from 'tsup'
import nodePreset from '@kb-labs/devkit/tsup/node.js'

export default defineConfig({
  ...nodePreset,
  entry: ['src/index.ts', 'src/cli.manifest.ts', 'src/cli/init.ts', 'src/cli/update.ts', 'src/cli/pack.ts', 'src/cli/feed.ts', 'src/cli/query.ts', 'src/cli/types.ts'],
  external: ['@kb-labs/mind-query', '@kb-labs/mind-indexer', '@kb-labs/mind-types'],
  dts: {
    resolve: true,
  },
})
