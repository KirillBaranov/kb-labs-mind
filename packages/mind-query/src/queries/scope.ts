/**
 * Scope query for KB Labs Mind Query
 */

import type { DepsGraph, ScopeResult } from '@kb-labs/mind-types';
import { toPosix } from '@kb-labs/mind-core';

export function queryScope(
  path: string,
  deps: DepsGraph,
  depth?: number
): ScopeResult {
  const normalizedPath = toPosix(path);
  const filtered = deps.edges.filter(edge => {
    const inScope = edge.from.startsWith(normalizedPath) && 
                    edge.to.startsWith(normalizedPath);
    
    if (!inScope) {return false;}
    
    if (depth !== undefined) {
      const fromDepth = edge.from.split('/').length;
      const toDepth = edge.to.split('/').length;
      const baseDepth = normalizedPath.split('/').length;
      return (fromDepth - baseDepth) <= depth && (toDepth - baseDepth) <= depth;
    }
    
    return true;
  });
  
  return { edges: filtered, count: filtered.length };
}
