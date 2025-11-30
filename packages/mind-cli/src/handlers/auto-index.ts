/**
 * @module @kb-labs/mind/handlers/auto-index
 * Auto-index handler - runs Mind RAG indexing automatically on schedule
 */

import type { Handler } from '@kb-labs/plugin-manifest';
import { runRagIndex } from '../application/rag';

interface AutoIndexInput {
  scopeId?: string;
}

interface AutoIndexOutput {
  success: boolean;
  scopeIds: string[];
  duration?: number;
  error?: string;
}

/**
 * Auto-index handler
 *
 * Runs Mind RAG indexing for specified scope (or all scopes if not specified).
 * This handler is invoked by the worker daemon based on the schedule defined
 * in manifest.v2.ts jobs section.
 */
export const run: Handler<AutoIndexInput, AutoIndexOutput> = async (input, ctx) => {
  const startTime = Date.now();

  ctx.logger?.info('Auto-index job started', {
    scopeId: input.scopeId,
    cwd: ctx.cwd,
  });

  try {
    const result = await runRagIndex({
      cwd: ctx.cwd,
      scopeId: input.scopeId,
    });

    const duration = Date.now() - startTime;

    ctx.logger?.info('Auto-index job completed', {
      scopeIds: result.scopeIds,
      duration,
    });

    return {
      success: true,
      scopeIds: result.scopeIds,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    ctx.logger?.error('Auto-index job failed', {
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      scopeIds: [],
      duration,
      error: errorMessage,
    };
  }
};
