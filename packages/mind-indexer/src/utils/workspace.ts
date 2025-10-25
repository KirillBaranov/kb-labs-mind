/**
 * Workspace utilities for KB Labs Mind Indexer
 */

import { findWorkspaceRoot } from "@kb-labs/mind-core";
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
  
  return {
    cwd,
    root,
    timeBudgetMs,
    startTime: Date.now(),
    log
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
