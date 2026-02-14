import { defineConfig } from 'tsup';
import nodePreset from '@kb-labs/devkit/tsup/node';

export default defineConfig({
  ...nodePreset,
  tsconfig: 'tsconfig.build.json',
  entry: [
    'src/index.ts',
    'src/manifest.v3.ts',
  ],
  dts: true,
  // React support for studio widgets
  esbuildOptions(options) {
    options.jsx = 'automatic';
    return options;
  },
  // Keep react external (not bundled)
  // Note: @kb-labs/* already external via nodePreset
  external: [
    'react',
    'react-dom',
  ],
});
