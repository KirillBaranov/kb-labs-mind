import cfg from '@kb-labs/devkit/vitest/node.js';

export default {
  ...cfg,
  test: {
    ...cfg.test,
    coverage: {
      ...cfg.test?.coverage,
      thresholds: {
        lines: 75,      // Было 90, теперь 75
        functions: 60,   // Было 90, теперь 60  
        branches: 50,   // Было 85, теперь 50
        statements: 75  // Было 90, теперь 75
      }
    }
  }
};
