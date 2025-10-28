/**
 * Workspace utilities for KB Labs Mind Indexer
 */

import { findWorkspaceRoot, toPosix } from "@kb-labs/mind-core";
import type { IndexerContext } from "../types/index.js";

/**
 * Create indexer context with workspace root detection
 */
export async function createIndexerContext(
  cwd: string,
  timeBudgetMs: number,
  log: (e: object) => void
): Promise<IndexerContext> {
  const root = await findWorkspaceRoot(cwd);
  const { getGenerator } = await import('@kb-labs/mind-core');
  
  const generator = getGenerator();
  
  return {
    cwd,
    root,
    timeBudgetMs,
    startTime: Date.now(),
    log,
    apiIndex: {
      schemaVersion: "1.0",
      generator,
      files: {}
    },
    depsGraph: {
      schemaVersion: "1.0",
      generator,
      root: toPosix(root),
      packages: {},
      edges: []
    },
    recentDiff: {
      schemaVersion: "1.0",
      generator,
      since: "",
      files: []
    }
  };
}

/**
 * Check if time budget is exceeded
 */
export function isTimeBudgetExceeded(ctx: IndexerContext): boolean {
  const elapsed = Date.now() - ctx.startTime;
  return elapsed >= ctx.timeBudgetMs;
}

/**
 * Get remaining time budget
 */
export function getRemainingTime(ctx: IndexerContext): number {
  const elapsed = Date.now() - ctx.startTime;
  return Math.max(0, ctx.timeBudgetMs - elapsed);
}
