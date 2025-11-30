/**
 * Main query executor for KB Labs Mind Query
 */

import { getLogger } from '@kb-labs/core-sys/logging';
import type { QueryName, QueryResult } from '@kb-labs/mind-types';
import { estimateTokens } from '@kb-labs/mind-core';
import { loadIndexes, createPathRegistry } from '../loader/index-loader';
import { QueryCache } from '../cache/query-cache';
import { generateAITemplate } from '../ai/templates';
import { queryImpact } from '../queries/impact';
import { queryScope } from '../queries/scope';
import { queryExports } from '../queries/exports';
import { queryExternals } from '../queries/externals';
import { queryChain } from '../queries/chain';
import { queryMeta } from '../queries/meta';
import { queryDocs } from '../queries/docs';

const logger = getLogger('mind:query:executor');

export interface QueryOptions {
  cwd: string;
  limit?: number;
  depth?: number;
  cacheTtl?: number;
  cacheMode?: 'ci' | 'local';
  noCache?: boolean;
  pathMode?: 'id' | 'absolute';
  aiMode?: boolean;
}

export async function executeQuery(
  name: QueryName,
  params: Record<string, any>,
  options: QueryOptions
): Promise<QueryResult> {
  const startTime = Date.now();
  const { 
    cwd, 
    limit = 500, 
    depth = 5, 
    cacheTtl = 60, 
    cacheMode = 'local',
    noCache = false, 
    pathMode = 'id', 
    aiMode = false 
  } = options;
  
  // Determine cache behavior based on mode
  const useCache = !noCache && cacheMode === 'local';
  
  try {
    const loadStart = Date.now();
    const indexes = await loadIndexes(cwd);
    const loadTime = Date.now() - loadStart;
    
    // Check cache
    const cache = new QueryCache(cwd);
    if (useCache) {
      const cached = await cache.get(
        name,
        params,
        indexes.index.depsHash,
        indexes.index.apiIndexHash,
        cacheTtl
      );
      if (cached) {
        cached.meta.cached = true;
        cached.meta.timingMs.total = Date.now() - startTime;
        return cached;
      }
    }
    
    // Execute query
    const filterStart = Date.now();
    let result: any;
    let filesScanned = 0;
    let edgesTouched = 0;
    
    switch (name) {
      case 'impact':
        result = queryImpact(params.file, indexes.deps);
        edgesTouched = indexes.deps.edges.length;
        break;
      case 'scope':
        result = queryScope(params.path, indexes.deps, depth);
        edgesTouched = indexes.deps.edges.length;
        break;
      case 'exports':
        result = queryExports(params.file, indexes.api);
        filesScanned = 1;
        break;
      case 'externals':
        result = queryExternals(indexes.deps, params.scope);
        edgesTouched = indexes.deps.edges.length;
        break;
      case 'chain':
        result = queryChain(params.file, indexes.deps, depth);
        edgesTouched = indexes.deps.edges.length;
        break;
      case 'meta':
        result = queryMeta(indexes.meta, params.product);
        filesScanned = 1;
        break;
      case 'docs':
        result = queryDocs(indexes.docs, {
          tag: params.tag,
          type: params.type,
          search: params.search
        });
        filesScanned = indexes.docs?.count || 0;
        break;
      default:
        throw new Error(`Unknown query: ${name}`);
    }
    
    const filterTime = Date.now() - filterStart;
    
    // Apply limit if needed
    const truncated = applyLimit(result, limit);
    
    // Build path registry if requested
    const paths = pathMode === 'id' ? createPathRegistry(collectPaths(result)) : undefined;
    
    // Build response
    const response: QueryResult = {
      ok: true,
      code: null,
      query: name,
      params,
      result,
      schemaVersion: "1.0",
      meta: {
        cwd,
        queryId: '',  // Will be set by cache
        tokensEstimate: estimateTokens(JSON.stringify(result)),
        cached: false,
        truncated,
        filesScanned,
        edgesTouched,
        depsHash: indexes.index.depsHash,
        apiHash: indexes.index.apiIndexHash,
        timingMs: {
          load: loadTime,
          filter: filterTime,
          total: Date.now() - startTime
        }
      },
      paths
    };
    
    // Generate summary and suggestions if AI mode
    if (aiMode) {
      const aiResult = generateAITemplate(name, result, params);
      response.summary = aiResult.summary;
      response.suggestNextQueries = aiResult.suggestNextQueries;
    }
    
    // Cache result
    if (useCache) {
      await cache.set(name, params, response, indexes.index.depsHash, indexes.index.apiIndexHash);
    }
    
    return response;
  } catch (error: any) {
    logger.error('Execute query error', {
      message: error.message,
      stack: error.stack,
    });
    return {
      ok: false,
      code: 'MIND_QUERY_ERROR',
      query: name,
      params,
      result: null,
      schemaVersion: "1.0",
      meta: {
        cwd,
        queryId: '',
        tokensEstimate: 0,
        cached: false,
        filesScanned: 0,
        edgesTouched: 0,
        depsHash: '',
        apiHash: '',
        timingMs: { load: 0, filter: 0, total: Date.now() - startTime }
      }
    };
  }
}

function smartTruncate(items: any[], limit: number) {
  const critical = items.filter(i => i.priority === 'critical');
  const important = items.filter(i => i.priority === 'important');
  const normal = items.filter(i => i.priority === 'normal');
  const noise = items.filter(i => i.priority === 'noise');
  
  const result = [...critical];
  if (result.length < limit) {result.push(...important.slice(0, limit - result.length));}
  if (result.length < limit) {result.push(...normal.slice(0, limit - result.length));}
  
  return {
    items: result,
    truncated: {
      critical: Math.max(0, critical.length - result.length),
      important: important.length - result.filter(i => i.priority === 'important').length,
      normal: normal.length - result.filter(i => i.priority === 'normal').length,
      noise: noise.length
    }
  };
}

function applyLimit(result: any, limit: number): boolean {
  // Apply smart truncation to arrays in result
  if (result.importers && result.importers.length > limit) {
    const truncated = smartTruncate(result.importers, limit);
    result.importers = truncated.items;
    result.truncated = truncated.truncated;
    return true;
  }
  if (result.edges && result.edges.length > limit) {
    const truncated = smartTruncate(result.edges, limit);
    result.edges = truncated.items;
    result.truncated = truncated.truncated;
    return true;
  }
  if (result.exports && result.exports.length > limit) {
    result.exports = result.exports.slice(0, limit);
    return true;
  }
  if (result.levels && result.levels.length > limit) {
    result.levels = result.levels.slice(0, limit);
    return true;
  }
  if (result.docs && result.docs.length > limit) {
    result.docs = result.docs.slice(0, limit);
    return true;
  }
  return false;
}

function collectPaths(result: any): string[] {
  const paths = new Set<string>();
  
  if (result.importers) {
    result.importers.forEach((imp: any) => paths.add(imp.file));
  }
  if (result.edges) {
    result.edges.forEach((edge: any) => {
      paths.add(edge.from);
      paths.add(edge.to);
    });
  }
  if (result.levels) {
    result.levels.forEach((level: any) => {
      level.files.forEach((f: string) => paths.add(f));
    });
  }
  if (result.docs) {
    result.docs.forEach((doc: any) => paths.add(doc.path));
  }
  
  return Array.from(paths).sort();
}

