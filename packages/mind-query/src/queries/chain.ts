/**
 * Chain query for KB Labs Mind Query
 */

import type { DepsGraph, ChainResult } from '@kb-labs/mind-types';
import { toPosix } from '@kb-labs/mind-core';

export function queryChain(
  file: string,
  deps: DepsGraph,
  maxDepth: number = 5
): ChainResult {
  const normalizedFile = toPosix(file);
  const visited = new Set<string>();
  const levels: Array<{ depth: number; files: string[] }> = [];
  
  let currentLevel = [normalizedFile];
  let depth = 0;
  
  while (currentLevel.length > 0 && depth <= maxDepth) {
    levels.push({ depth, files: [...currentLevel] });
    currentLevel.forEach(f => visited.add(f));
    
    // Find next level dependencies
    const nextLevel = new Set<string>();
    for (const node of currentLevel) {
      for (const edge of deps.edges) {
        if (edge.from === node && !visited.has(edge.to)) {
          nextLevel.add(edge.to);
        }
      }
    }
    
    currentLevel = Array.from(nextLevel);
    depth++;
  }
  
  return { levels, visited: visited.size };
}
