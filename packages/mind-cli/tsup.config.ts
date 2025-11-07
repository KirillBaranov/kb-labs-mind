import { defineConfig } from 'tsup'
import nodePreset from '@kb-labs/devkit/tsup/node.js'

export default defineConfig({
  ...nodePreset,
  entry: [
    'src/index.ts',
    'src/manifest.v2.ts',
    'src/cli/init.ts',
    'src/cli/update.ts',
    'src/cli/pack.ts',
    'src/cli/feed.ts',
    'src/cli/query.ts',
    'src/cli/verify.ts',
    'src/cli/types.ts',
    'src/gateway/handlers/query-handler.ts',
    'src/gateway/handlers/verify-handler.ts',
    'src/studio/widgets/query-widget.tsx',
    'src/studio/widgets/verify-widget.tsx',
  ],
  external: [
    '@kb-labs/mind-query',
    '@kb-labs/mind-indexer',
    '@kb-labs/mind-types',
    '@kb-labs/mind-gateway',
    '@kb-labs/shared-cli-ui',
    'react',
    'react-dom',
  ],
  dts: {
    resolve: true,
    skipLibCheck: true,
    // Ensure .d.ts files are generated for all entries including widgets
  },
  // Ensure TypeScript declarations are generated for React components
  esbuildOptions(options) {
    options.jsx = 'automatic';
    return options;
  },
})
