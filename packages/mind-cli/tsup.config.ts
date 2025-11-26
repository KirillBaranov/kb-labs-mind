import { defineConfig } from 'tsup'
import nodePreset from '@kb-labs/devkit/tsup/node.js'

export default defineConfig({
  ...nodePreset,
  tsconfig: "tsconfig.build.json", // Use build-specific tsconfig without paths
  entry: [
    'src/index.ts',
    'src/manifest.v2.ts',
    'src/application/index.ts',
    'src/application/sync.ts',
    'src/rest/index.ts',
    'src/cli/index.ts',
    'src/studio/index.ts',
    'src/cli/commands/init.ts',
    'src/cli/commands/update.ts',
    'src/cli/commands/pack.ts',
    'src/cli/commands/feed.ts',
    'src/cli/commands/query.ts',
    'src/cli/commands/rag-index.ts',
    'src/cli/commands/rag-query.ts',
    'src/cli/commands/verify.ts',
    'src/cli/commands/sync.ts',
    'src/cli/types.ts',
    'src/rest/handlers/query-handler.ts',
    'src/rest/handlers/verify-handler.ts',
    'src/studio/widgets/query-widget.tsx',
    'src/studio/widgets/verify-widget.tsx',
  ],
  external: [
    '@kb-labs/mind-query',
    '@kb-labs/mind-indexer',
    '@kb-labs/mind-types',
    '@kb-labs/mind-gateway',
    '@kb-labs/mind-contracts',
    '@kb-labs/shared-cli-ui',
    'react',
    'react-dom',
  ],
  treeshake: false,
  dts: false, // Disabled for OOM debugging
  // Ensure TypeScript declarations are generated for React components
  esbuildOptions(options) {
    options.jsx = 'automatic';
    return options;
  },
})
