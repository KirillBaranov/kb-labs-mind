import cfg from '@kb-labs/devkit/vitest/node.js';

export default {
  ...cfg,
  test: {
    ...cfg.test,
    testTimeout: 30000,
    setupFiles: ['./src/setup.ts']
  }
};
