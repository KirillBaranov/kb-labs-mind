import { defineConfig } from 'tsup';
import nodePreset from '@kb-labs/devkit/tsup/node.js';

export default defineConfig({
  ...nodePreset,
  entry: ['src/index.ts', 'src/contract.ts', 'src/schema.ts'],
  dts: {
    resolve: true,
    skipLibCheck: true,
  },
  treeshake: false,
});
