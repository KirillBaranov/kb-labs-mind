/**
 * Index loader for KB Labs Mind Query
 */

import { readJson } from '@kb-labs/mind-indexer';
import type { MindIndex, ApiIndex, DepsGraph, ProjectMeta, DocsIndex } from '@kb-labs/mind-types';
import { join } from 'node:path';

export interface LoadedIndexes {
  index: MindIndex;
  api: ApiIndex;
  deps: DepsGraph;
  meta?: ProjectMeta;
  docs?: DocsIndex;
}

let cachedIndexes: LoadedIndexes | null = null;

export async function loadIndexes(cwd: string): Promise<LoadedIndexes> {
  const mindDir = join(cwd, '.kb', 'mind');
  
  const [index, api, deps, meta, docs] = await Promise.all([
    readJson<MindIndex>(join(mindDir, 'index.json')),
    readJson<ApiIndex>(join(mindDir, 'api-index.json')),
    readJson<DepsGraph>(join(mindDir, 'deps.json')),
    readJson<ProjectMeta>(join(mindDir, 'meta.json')),
    readJson<DocsIndex>(join(mindDir, 'docs-index.json'))
  ]);
  
  if (!index || !api || !deps) {
    throw new Error('Mind indexes not found. Run: kb mind init && kb mind update');
  }
  
  cachedIndexes = { index, api, deps, meta: meta || undefined, docs: docs || undefined };
  return cachedIndexes;
}

export function createPathRegistry(files: string[]): Record<string, string> {
  const registry: Record<string, string> = {};
  files.forEach((file, idx) => {
    registry[`f${idx + 1}`] = file;
  });
  return registry;
}

export function clearCache(): void {
  cachedIndexes = null;
}
