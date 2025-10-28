/**
 * Query cache for KB Labs Mind Query
 */

import { readJson, writeJson } from '@kb-labs/mind-indexer';
import { sha256 } from '@kb-labs/mind-core';
import type { QueryCacheEntry, QueryResult, QueryName } from '@kb-labs/mind-types';
import { join } from 'node:path';

export class QueryCache {
  private cacheFile: string;
  
  constructor(cwd: string) {
    this.cacheFile = join(cwd, '.kb', 'mind', 'query-cache.json');
  }
  
  async get(
    queryName: QueryName,
    params: Record<string, any>,
    depsHash: string,
    apiHash: string,
    ttlSeconds: number = 60
  ): Promise<QueryResult | null> {
    try {
      const cache = await readJson<Record<string, QueryCacheEntry>>(this.cacheFile) || {};
      const queryId = this.generateQueryId(queryName, params, depsHash, apiHash);
      const entry = cache[queryId];
      
      if (!entry) {return null;}
      
      // Check hash invalidation
      if (entry.depsHash !== depsHash || entry.apiHash !== apiHash) {
        return null;
      }
      
      // Check TTL
      const age = (Date.now() - new Date(entry.createdAt).getTime()) / 1000;
      if (age > ttlSeconds) {
        return null;
      }
      
      return entry.result;
    } catch {
      return null;
    }
  }
  
  async set(
    queryName: QueryName,
    params: Record<string, any>,
    result: QueryResult,
    depsHash: string,
    apiHash: string
  ): Promise<void> {
    try {
      const cache = await readJson<Record<string, QueryCacheEntry>>(this.cacheFile) || {};
      const queryId = this.generateQueryId(queryName, params, depsHash, apiHash);
      
      cache[queryId] = {
        queryId,
        depsHash,
        apiHash,
        result,
        createdAt: new Date().toISOString()
      };
      
      // Cleanup old entries (keep last 100)
      const entries = Object.entries(cache);
      if (entries.length > 100) {
        const sorted = entries.sort((a, b) => 
          new Date(b[1].createdAt).getTime() - new Date(a[1].createdAt).getTime()
        );
        const cleaned = Object.fromEntries(sorted.slice(0, 100));
        await writeJson(this.cacheFile, cleaned);
      } else {
        await writeJson(this.cacheFile, cache);
      }
    } catch {
      // Fail silently - caching is optional
    }
  }
  
  private generateQueryId(
    queryName: QueryName,
    params: Record<string, any>,
    depsHash: string,
    apiHash: string
  ): string {
    const sortedParams = JSON.stringify(params, Object.keys(params).sort());
    const input = `${queryName}|${sortedParams}|${depsHash}|${apiHash}`;
    return `Q-${sha256(input).slice(0, 12)}`;
  }
}
