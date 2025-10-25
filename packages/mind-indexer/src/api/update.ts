/**
 * Update indexes API
 */

import { createIndexerContext, isTimeBudgetExceeded } from "../utils/workspace.js";
import { readJson, writeJson, computeJsonHash } from "../fs/json.js";
import { orchestrateIndexing } from "../orchestrator/orchestrator.js";
import { DEFAULT_TIME_BUDGET_MS } from "@kb-labs/mind-core";
import type { UpdateOptions, DeltaReport } from "../types/index.js";
import type { MindIndex, ApiIndex, DepsGraph, RecentDiff } from "@kb-labs/mind-core";

/**
 * Update Mind indexes with delta indexing
 */
export async function updateIndexes(opts: UpdateOptions): Promise<DeltaReport> {
  const { cwd, changed, since, timeBudgetMs = DEFAULT_TIME_BUDGET_MS, log } = opts;
  
  const startTime = Date.now();
  const ctx = await createIndexerContext(cwd, timeBudgetMs, log || (() => {}));
  
  try {
    // Load existing indexes
    const [index, apiIndex, depsGraph, recentDiff] = await Promise.all([
      readJson<MindIndex>(`${cwd}/.kb/mind/index.json`),
      readJson<ApiIndex>(`${cwd}/.kb/mind/api-index.json`),
      readJson<DepsGraph>(`${cwd}/.kb/mind/deps.json`),
      readJson<RecentDiff>(`${cwd}/.kb/mind/recent-diff.json`)
    ]);

    // Initialize if not exists
    if (!index || !apiIndex || !depsGraph || !recentDiff) {
      log?.({ level: 'warn', msg: 'Mind structure not initialized, creating empty indexes' });
      // Create minimal structures
      const generator = "kb-labs-mind@0.1.0";
      const now = new Date().toISOString();
      
      const newIndex: MindIndex = {
        schemaVersion: "1.0",
        generator,
        updatedAt: now,
        root: ctx.root,
        filesIndexed: 0,
        apiIndexHash: "",
        depsHash: "",
        recentDiffHash: ""
      };
      
      const newApiIndex: ApiIndex = {
        schemaVersion: "1.0",
        generator,
        files: {}
      };
      
      const newDepsGraph: DepsGraph = {
        schemaVersion: "1.0",
        generator,
        packages: {},
        edges: []
      };
      
      const newRecentDiff: RecentDiff = {
        schemaVersion: "1.0",
        generator,
        since: since || "",
        files: []
      };
      
      await Promise.all([
        writeJson(`${cwd}/.kb/mind/index.json`, newIndex),
        writeJson(`${cwd}/.kb/mind/api-index.json`, newApiIndex),
        writeJson(`${cwd}/.kb/mind/deps.json`, newDepsGraph),
        writeJson(`${cwd}/.kb/mind/recent-diff.json`, newRecentDiff)
      ]);
      
      return {
        api: { added: 0, updated: 0, removed: 0 },
        budget: { limitMs: timeBudgetMs, usedMs: Date.now() - startTime },
        durationMs: Date.now() - startTime
      };
    }

    // Check time budget
    if (isTimeBudgetExceeded(ctx)) {
      log?.({ level: 'warn', code: 'MIND_TIME_BUDGET', msg: 'Time budget exceeded before processing' });
      return {
        api: { added: 0, updated: 0, removed: 0 },
        budget: { limitMs: timeBudgetMs, usedMs: Date.now() - startTime },
        partial: true,
        durationMs: Date.now() - startTime
      };
    }

    // Use orchestrator for actual indexing
    const result = await orchestrateIndexing(ctx, changed || [], since);

    // Update index with new hashes
    const now = new Date().toISOString();
    const updatedIndex: MindIndex = {
      ...index,
      updatedAt: now,
      apiIndexHash: computeJsonHash(apiIndex),
      depsHash: computeJsonHash(depsGraph),
      recentDiffHash: computeJsonHash(recentDiff)
    };

    await writeJson(`${cwd}/.kb/mind/index.json`, updatedIndex);

    return result;
  } catch (error: any) {
    log?.({ level: 'error', msg: 'Failed to update indexes', error: error.message });
    throw error;
  }
}
