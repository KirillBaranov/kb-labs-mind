import config from "@kb-labs/devkit/vitest/node.js";

export default {
  ...config,
  test: {
    ...config.test,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
};
