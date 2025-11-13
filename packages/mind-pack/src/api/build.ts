/**
 * Build context pack API
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_BUDGET, DEFAULT_PRESET } from '@kb-labs/mind-core';
import { orchestratePackBuilding } from '../builder/orchestrator.js';
import type { PackOptions, PackResult } from '../types/index.js';
import type { MindIndex, ApiIndex, DepsGraph, RecentDiff } from '@kb-labs/mind-core';
import type { ProjectMeta, DocsIndex } from '@kb-labs/mind-types';

/**
 * Build context pack from Mind indexes
 */
export async function buildPack(opts: PackOptions): Promise<PackResult> {
  const { 
    cwd, 
    intent, 
    product, 
    preset = DEFAULT_PRESET, 
    budget = DEFAULT_BUDGET, 
    withBundle = false, 
    seed,
    log 
  } = opts;

  const context = {
    cwd,
    product,
    intent,
    budget,
    preset,
    withBundle,
    seed,
    log: log || (() => {})
  };

  try {
    // Load Mind indexes
    const [index, apiIndex, depsGraph, recentDiff, metaIndex, docsPrimary, docsLegacy] = await Promise.all([
      loadIndex(cwd, 'index.json') as Promise<MindIndex>,
      loadIndex(cwd, 'api-index.json') as Promise<ApiIndex>,
      loadIndex(cwd, 'deps.json') as Promise<DepsGraph>,
      loadIndex(cwd, 'recent-diff.json') as Promise<RecentDiff>,
      loadIndex(cwd, 'meta.json') as Promise<ProjectMeta>,
      loadIndex(cwd, 'docs.json') as Promise<DocsIndex>,
      loadIndex(cwd, 'docs-index.json') as Promise<DocsIndex>
    ]);
    const docsIndex = docsPrimary ?? docsLegacy ?? null;

    if (!index || !apiIndex || !depsGraph || !recentDiff || 
        !index.schemaVersion || !apiIndex.schemaVersion || !depsGraph.schemaVersion || !recentDiff.schemaVersion) {
      throw new Error('Mind indexes not found. Run "kb mind init" first.');
    }

    // Use orchestrator for pack building
    const result = await orchestratePackBuilding(
      context,
      index,
      apiIndex,
      depsGraph,
      recentDiff,
      metaIndex ?? null,
      docsIndex
    );

    return {
      json: result.json,
      markdown: result.markdown,
      tokensEstimate: result.tokensEstimate
    };
  } catch (error: any) {
    context.log({ level: 'error', msg: 'Failed to build pack', error: error.message });
    throw error;
  }
}

/**
 * Load Mind index file
 */
async function loadIndex<T>(cwd: string, filename: string): Promise<T | null> {
  try {
    const content = await readFile(join(cwd, '.kb', 'mind', filename), 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
