import config from "@kb-labs/devkit/tsup/node.js";

export default {
  ...config,
  entry: { 
    index: "src/index.ts",
    "cli.manifest": "src/cli.manifest.ts",
    "cli/init": "src/cli/init.ts",
    "cli/pack": "src/cli/pack.ts",
    "cli/update": "src/cli/update.ts",
    "cli/feed": "src/cli/feed.ts",
    "cli/types": "src/cli/types.ts"
  },
  clean: false,
  skipNodeModulesBundle: true,
};
