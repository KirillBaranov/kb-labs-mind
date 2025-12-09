/**
 * Query Cache
 *
 * LRU cache for repeated queries to reduce LLM calls
 * and improve response times.
 *
 * Supports optional StateBroker backend for persistent cross-invocation caching.
 */

import { createHash } from 'node:crypto';
import type { AgentQueryMode, AgentResponse } from '@kb-labs/sdk';

export interface CacheEntry {
  response: AgentResponse;
  timestamp: number;
  hits: number;
  queryHash: string;
}

export interface StateBrokerLike {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface QueryCacheOptions {
  /** Maximum cache entries (for in-memory fallback) */
  maxSize?: number;
  /** Default TTL in milliseconds */
  defaultTtlMs?: number;
  /** TTL by mode (more complex modes cache longer) */
  ttlByMode?: Record<AgentQueryMode, number>;
  /** Optional state broker for persistent caching */
  broker?: StateBrokerLike;
}

const DEFAULT_OPTIONS = {
  maxSize: 100,
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  ttlByMode: {
    instant: 2 * 60 * 1000,   // 2 minutes
    auto: 5 * 60 * 1000,      // 5 minutes
    thinking: 15 * 60 * 1000, // 15 minutes
  },
};

/**
 * Query Cache - LRU cache for agent responses
 *
 * Two-tier caching strategy:
 * 1. StateBroker (persistent, cross-invocation) - if available
 * 2. In-memory LRU (fallback) - always available
 */
export class QueryCache {
  private readonly options: Required<Omit<QueryCacheOptions, 'broker'>>;
  private readonly broker?: StateBrokerLike;
  private readonly cache: Map<string, CacheEntry>;
  private readonly accessOrder: string[];

  constructor(options: QueryCacheOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.broker = options.broker;
    this.cache = new Map();
    this.accessOrder = [];
  }

  /**
   * Generate cache key from query parameters
   */
  private generateKey(
    query: string,
    scopeId: string,
    mode: AgentQueryMode,
  ): string {
    const normalized = query.toLowerCase().trim();
    const hash = createHash('sha256')
      .update(`${scopeId}:${mode}:${normalized}`)
      .digest('hex')
      .substring(0, 16);
    return hash;
  }

  /**
   * Get cached response if available and not expired
   */
  async get(
    query: string,
    scopeId: string,
    mode: AgentQueryMode,
  ): Promise<AgentResponse | null> {
    const key = this.generateKey(query, scopeId, mode);
    const ttl = this.options.ttlByMode[mode] ?? this.options.defaultTtlMs;

    // Try StateBroker first (persistent cache)
    if (this.broker) {
      try {
        const brokerKey = `mind:query:${key}`;
        const entry = await this.broker.get<CacheEntry>(brokerKey);

        if (entry) {
          // Check TTL
          const age = Date.now() - entry.timestamp;
          if (age <= ttl) {
            // Cache hit
            return {
              ...entry.response,
              meta: {
                ...entry.response.meta,
                cached: true,
              },
            };
          }
        }
      } catch (error) {
        // Fallback to in-memory if broker fails
      }
    }

    // Fallback to in-memory cache
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    const age = Date.now() - entry.timestamp;

    if (age > ttl) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access order (LRU)
    this.updateAccessOrder(key);
    entry.hits++;

    // Return cached response with updated meta
    return {
      ...entry.response,
      meta: {
        ...entry.response.meta,
        cached: true,
      },
    };
  }

  /**
   * Store response in cache
   */
  async set(
    query: string,
    scopeId: string,
    mode: AgentQueryMode,
    response: AgentResponse,
  ): Promise<void> {
    // Don't cache error responses or low confidence
    if (response.confidence < 0.3) {
      return;
    }

    const key = this.generateKey(query, scopeId, mode);
    const ttl = this.options.ttlByMode[mode] ?? this.options.defaultTtlMs;

    const entry: CacheEntry = {
      response,
      timestamp: Date.now(),
      hits: 0,
      queryHash: key,
    };

    // Store in StateBroker first (persistent cache)
    if (this.broker) {
      try {
        const brokerKey = `mind:query:${key}`;
        await this.broker.set(brokerKey, entry, ttl);
      } catch (error) {
        // Fallback to in-memory if broker fails
      }
    }

    // Always store in in-memory cache too (L2 cache)
    // Evict if at capacity
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  /**
   * Invalidate cache for a scope (e.g., after re-indexing)
   */
  invalidateScope(scopeId: string): number {
    let invalidated = 0;
    const keysToDelete: string[] = [];

    // We need to check each entry - in production, use a scope index
    for (const [key, _entry] of this.cache) {
      // Since we hash the key, we can't easily filter by scope
      // For now, clear everything (in production, store scope in entry)
      keysToDelete.push(key);
      invalidated++;
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }

    return invalidated;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.length = 0;
  }

  /**
   * Get cache statistics
   */
  stats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ queryHash: string; hits: number; age: number }>;
  } {
    const now = Date.now();
    let totalHits = 0;

    const entries = Array.from(this.cache.entries()).map(([key, entry]) => {
      totalHits += entry.hits;
      return {
        queryHash: key,
        hits: entry.hits,
        age: now - entry.timestamp,
      };
    });

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: entries.length > 0 ? totalHits / entries.length : 0,
      entries,
    };
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Remove from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }
}

/**
 * Create a query cache instance
 */
export function createQueryCache(options?: QueryCacheOptions): QueryCache {
  return new QueryCache(options);
}

/**
 * Generate a query hash for external use
 */
export function hashQuery(
  query: string,
  scopeId: string,
  mode: AgentQueryMode,
): string {
  const normalized = query.toLowerCase().trim();
  return createHash('sha256')
    .update(`${scopeId}:${mode}:${normalized}`)
    .digest('hex')
    .substring(0, 16);
}
