import { defineConfig } from 'tsup';
import nodePreset from '@kb-labs/devkit/tsup/node.js';

export default defineConfig({
  ...nodePreset,
  tsconfig: "tsconfig.build.json", // Use build-specific tsconfig without paths
  dts: false, // TEMPORARILY disabled - will fix type issues separately
  external: [
    ...(nodePreset.external || []),
    '@kb-labs/core-platform',
  ],
});
