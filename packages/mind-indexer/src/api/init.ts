/**
 * Initialize Mind structure API
 */

import { ensureMindStructure } from "../fs/ensure.js";
import { writeJson } from "../fs/json.js";
import { getGenerator } from "@kb-labs/mind-core";
import type { InitOptions } from "../types/index.js";
import type { MindIndex, ApiIndex, DepsGraph, RecentDiff } from "@kb-labs/mind-core";

/**
 * Initialize Mind structure with empty JSON artifacts
 */
export async function initMindStructure(opts: InitOptions): Promise<void> {
  const { cwd, log } = opts;
  
  try {
    // Ensure directory structure
    const mindDir = await ensureMindStructure(cwd);
    log?.({ level: 'info', msg: 'Created .kb/mind directory structure', path: mindDir });

    const generator = getGenerator();
    const now = new Date().toISOString();

    // Create empty index.json
    const index: MindIndex = {
      schemaVersion: "1.0",
      generator,
      updatedAt: now,
      root: cwd,
      filesIndexed: 0,
      apiIndexHash: "",
      depsHash: "",
      recentDiffHash: ""
    };

    // Create empty api-index.json
    const apiIndex: ApiIndex = {
      schemaVersion: "1.0",
      generator,
      files: {}
    };

    // Create empty deps.json
    const depsGraph: DepsGraph = {
      schemaVersion: "1.0",
      generator,
      packages: {},
      edges: []
    };

    // Create empty recent-diff.json
    const recentDiff: RecentDiff = {
      schemaVersion: "1.0",
      generator,
      since: "",
      files: []
    };

    // Write all files atomically
    await Promise.all([
      writeJson(`${mindDir}/index.json`, index),
      writeJson(`${mindDir}/api-index.json`, apiIndex),
      writeJson(`${mindDir}/deps.json`, depsGraph),
      writeJson(`${mindDir}/recent-diff.json`, recentDiff)
    ]);

    log?.({ level: 'info', msg: 'Initialized Mind structure with empty artifacts' });
  } catch (error: any) {
    log?.({ level: 'error', msg: 'Failed to initialize Mind structure', error: error.message });
    throw error;
  }
}
