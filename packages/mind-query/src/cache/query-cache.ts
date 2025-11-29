/**
 * Query cache for KB Labs Mind Query
 */

import { readJson, writeJson } from '@kb-labs/mind-indexer';
import { sha256 } from '@kb-labs/mind-core';
import type { QueryCacheEntry, QueryResult, QueryName } from '@kb-labs/mind-types';
import { join } from 'node:path';

// StateBroker interface (minimal subset needed for QueryCache)
interface StateBrokerLike {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class QueryCache {
  private cacheFile: string;
  private broker?: StateBrokerLike;

  constructor(cwd: string, broker?: StateBrokerLike) {
    this.cacheFile = join(cwd, '.kb', 'mind', 'query-cache.json');
    this.broker = broker;
  }
  
  async get(
    queryName: QueryName,
    params: Record<string, any>,
    depsHash: string,
    apiHash: string,
    ttlSeconds: number = 60
  ): Promise<QueryResult | null> {
    const queryId = this.generateQueryId(queryName, params, depsHash, apiHash);

    // Use StateBroker if available
    if (this.broker) {
      try {
        const entry = await this.broker.get<QueryCacheEntry>(queryId);
        if (!entry) return null;

        // Check hash invalidation
        if (entry.depsHash !== depsHash || entry.apiHash !== apiHash) {
          return null;
        }

        // TTL is handled by broker itself, but double-check for safety
        const age = (Date.now() - new Date(entry.createdAt).getTime()) / 1000;
        if (age > ttlSeconds) {
          return null;
        }

        return entry.result;
      } catch {
        return null;
      }
    }

    // Fallback to file-based cache
    try {
      const cache = await readJson<Record<string, QueryCacheEntry>>(this.cacheFile) || {};
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
    const queryId = this.generateQueryId(queryName, params, depsHash, apiHash);

    const entry: QueryCacheEntry = {
      queryId,
      depsHash,
      apiHash,
      result,
      createdAt: new Date().toISOString()
    };

    // Use StateBroker if available
    if (this.broker) {
      try {
        // Store with TTL (default 60 seconds in milliseconds)
        await this.broker.set(queryId, entry, 60 * 1000);
      } catch {
        // Fail silently - caching is optional
      }
      return;
    }

    // Fallback to file-based cache
    try {
      const cache = await readJson<Record<string, QueryCacheEntry>>(this.cacheFile) || {};
      cache[queryId] = entry;

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
