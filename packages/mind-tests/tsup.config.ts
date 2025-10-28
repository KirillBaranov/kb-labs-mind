import cfg from '@kb-labs/devkit/tsup/node.js';

export default {
  ...cfg,
  entry: ['src/index.ts'],
  outDir: 'dist'
};
