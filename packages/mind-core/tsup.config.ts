import config from "@kb-labs/devkit/tsup/node.js";

export default {
  ...config,
  entry: { 
    index: "src/index.ts",
    "cli.manifest": "src/cli.manifest.ts"
  },
  clean: false,
  skipNodeModulesBundle: true,
};
