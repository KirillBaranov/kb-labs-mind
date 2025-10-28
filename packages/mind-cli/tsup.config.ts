import baseConfig from '@kb-labs/devkit/tsup/node.js';

export default {
  ...baseConfig,
  entry: ['src/index.ts', 'src/cli.manifest.ts', 'src/cli/init.ts', 'src/cli/update.ts', 'src/cli/pack.ts', 'src/cli/feed.ts', 'src/cli/query.ts', 'src/cli/types.ts']
};
