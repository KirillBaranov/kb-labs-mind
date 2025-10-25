/**
 * Dependencies indexer for KB Labs Mind
 */

import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import type { DepsGraph, PackageNode } from '@kb-labs/mind-core';
import type { IndexerContext } from '../types/index.js';

/**
 * Index package dependencies
 */
export async function indexDependencies(
  ctx: IndexerContext
): Promise<{ edgesAdded: number; edgesRemoved: number }> {
  let edgesAdded = 0;
  let edgesRemoved = 0;

  try {
    // Read package.json
    const packageJsonPath = join(ctx.cwd, 'package.json');
    const packageJson = JSON.parse(await fsp.readFile(packageJsonPath, 'utf8'));

    // Create package node
    const packageNode: PackageNode = {
      name: packageJson.name || 'unknown',
      version: packageJson.version,
      private: packageJson.private || false,
      dir: '.',
      deps: Object.keys(packageJson.dependencies || {})
    };

    // TODO: Build dependency graph
    // For now, just return counts
    edgesAdded = Object.keys(packageJson.dependencies || {}).length;
    edgesRemoved = 0;

  } catch (error: any) {
    ctx.log({ 
      level: 'warn', 
      code: 'MIND_PARSE_ERROR', 
      msg: 'Failed to parse package.json', 
      error: error.message 
    });
  }

  return { edgesAdded, edgesRemoved };
}
