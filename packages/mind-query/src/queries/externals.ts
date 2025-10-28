/**
 * Externals query for KB Labs Mind Query
 */

import type { DepsGraph, ExternalsResult } from '@kb-labs/mind-types';
import { toPosix } from '@kb-labs/mind-core';

export function queryExternals(
  deps: DepsGraph,
  scope?: string
): ExternalsResult {
  const normalizedScope = scope ? toPosix(scope) : null;
  const externals: Record<string, Set<string>> = {};
  
  // If no edges, use summary data as fallback
  if (deps.edges.length === 0 && deps.summary?.externalDeps) {
    const result: Record<string, string[]> = {};
    for (const pkg of deps.summary.externalDeps) {
      result[pkg] = ['summary']; // Indicate this came from summary
    }
    return { externals: result, count: Object.keys(result).length };
  }
  
  for (const edge of deps.edges) {
    // Skip if scope is specified and from is not in scope
    if (normalizedScope && !edge.from.startsWith(normalizedScope)) {
      continue;
    }
    
    // Check if 'to' is external (not a relative/internal path)
    if (!edge.to.startsWith('.') && !edge.to.startsWith('/')) {
      // Extract package name (handle scoped packages)
      const pkgName = edge.to.startsWith('@') 
        ? edge.to.split('/').slice(0, 2).join('/')
        : edge.to.split('/')[0];
      
      if (pkgName && pkgName.length > 0) {
        if (!externals[pkgName]) {
          externals[pkgName] = new Set();
        }
        externals[pkgName].add(edge.from);
      }
    }
  }
  
  const result: Record<string, string[]> = {};
  Object.entries(externals).forEach(([pkg, files]) => {
    result[pkg] = Array.from(files).sort();
  });
  
  return { externals: result, count: Object.keys(result).length };
}