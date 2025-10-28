/**
 * Orchestrator for KB Labs Mind Indexer
 */

import { indexApiFiles } from '../indexers/api.js';
import { indexDependencies } from '../indexers/deps.js';
import { indexGitDiff } from '../indexers/diff.js';
import { indexMeta } from '../indexers/meta.js';
import { indexDocs } from '../indexers/docs.js';
import { isTimeBudgetExceeded } from '../utils/workspace.js';
import type { IndexerContext } from '../types/index.js';
import type { DeltaReport } from '../types/index.js';

/**
 * Orchestrate the indexing process with time budget control
 */
export async function orchestrateIndexing(
  ctx: IndexerContext,
  filePaths: string[],
  since?: string
): Promise<DeltaReport> {
  const startTime = Date.now();
  
  try {
    // Check initial time budget
    if (isTimeBudgetExceeded(ctx)) {
      ctx.log({ 
        level: 'warn', 
        code: 'MIND_TIME_BUDGET', 
        msg: 'Time budget exceeded before processing' 
      });
      return {
        api: { added: 0, updated: 0, removed: 0 },
        budget: { limitMs: ctx.timeBudgetMs, usedMs: Date.now() - ctx.startTime },
        partial: true,
        durationMs: Date.now() - startTime
      };
    }

    // Index API files
    const apiResult = await indexApiFiles(ctx, filePaths);
    
    // Check time budget after API indexing
    if (isTimeBudgetExceeded(ctx)) {
      ctx.log({ 
        level: 'warn', 
        code: 'MIND_TIME_BUDGET', 
        msg: 'Time budget exceeded after API indexing' 
      });
      return {
        api: apiResult,
        budget: { limitMs: ctx.timeBudgetMs, usedMs: Date.now() - ctx.startTime },
        partial: true,
        durationMs: Date.now() - startTime
      };
    }

    // Index dependencies
    const depsResult = await indexDependencies(ctx);
    
    // Check time budget after deps indexing
    if (isTimeBudgetExceeded(ctx)) {
      ctx.log({ 
        level: 'warn', 
        code: 'MIND_TIME_BUDGET', 
        msg: 'Time budget exceeded after deps indexing' 
      });
      return {
        api: apiResult,
        deps: depsResult,
        budget: { limitMs: ctx.timeBudgetMs, usedMs: Date.now() - ctx.startTime },
        partial: true,
        durationMs: Date.now() - startTime
      };
    }

    // Index git diff
    const diffResult = await indexGitDiff(ctx, since);

    // Index meta and docs (non-critical, can be skipped if time budget exceeded)
    try {
      await indexMeta(ctx);
      await indexDocs(ctx);
    } catch (error: any) {
      ctx.log({ 
        level: 'warn', 
        msg: 'Meta/docs indexing failed', 
        error: error.message 
      });
    }

    const usedMs = Date.now() - ctx.startTime;
    const partial = usedMs >= ctx.timeBudgetMs;

    if (partial) {
      ctx.log({ 
        level: 'warn', 
        code: 'MIND_TIME_BUDGET', 
        msg: 'Time budget exceeded during processing' 
      });
    }

    // Note: Results are saved by individual indexers
    // This orchestrator only coordinates the process

    return {
      api: apiResult,
      deps: depsResult,
      diff: diffResult,
      budget: { limitMs: ctx.timeBudgetMs, usedMs },
      partial,
      durationMs: Date.now() - startTime
    };

  } catch (error: any) {
    ctx.log({ 
      level: 'error', 
      msg: 'Orchestration failed', 
      error: error.message 
    });
    throw error;
  }
}
