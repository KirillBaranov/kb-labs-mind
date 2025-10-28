/**
 * Impact query for KB Labs Mind Query
 */

import type { DepsGraph, ImpactResult } from '@kb-labs/mind-types';
import { toPosix } from '@kb-labs/mind-core';

function computeRelevance(importer: string, target: string, imports: string[]): number {
  let score = 0.5;
  score += Math.min(imports.length * 0.1, 0.3);
  if (importer.includes('/bin.') || importer.includes('/cli.')) {score += 0.2;}
  return Math.min(score, 1.0);
}

function getFileContext(file: string): string {
  if (file.includes('/bin.')) {return 'CLI entry point';}
  if (file.includes('/index.')) {return 'Package entry';}
  if (file.includes('/api/')) {return 'Public API';}
  return 'Implementation';
}

export function queryImpact(file: string, deps: DepsGraph): ImpactResult {
  const normalizedFile = toPosix(file);
  const importers = new Map<string, string[]>();
  
  for (const edge of deps.edges) {
    if (edge.to === normalizedFile) {
      const existing = importers.get(edge.from) || [];
      importers.set(edge.from, [...existing, ...(edge.imports || [])]);
    }
  }
  
  const result = Array.from(importers.entries()).map(([file, imports]) => ({
    file,
    imports: [...new Set(imports)],  // Dedupe
    relevance: computeRelevance(file, normalizedFile, imports),
    context: getFileContext(file)
  })).sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  
  return { importers: result, count: result.length };
}
