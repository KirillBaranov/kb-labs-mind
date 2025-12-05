import { defineConfig } from 'tsup'

export default defineConfig({
  // Development mode: workspace packages via pnpm symlinks
  // For production packaging, use separate plugin SDK build
  format: ['esm'],
  target: 'es2022',
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  splitting: false,
  minify: false,
  skipNodeModulesBundle: true,
  shims: false,
  tsconfig: "tsconfig.build.json",

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

  // Development: all workspace packages external (resolved via pnpm workspace)
  external: [
    /^@kb-labs\/.*/,  // All @kb-labs/* packages
    'react',
    'react-dom',
  ],

  treeshake: false,
  dts: false, // TEMPORARY: disabled until type issues fixed

  esbuildOptions(options) {
    options.jsx = 'automatic';
    return options;
  },
})
