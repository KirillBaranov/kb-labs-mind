/**
 * @module @kb-labs/mind-cli/core/query
 * Core query execution logic (shared between CLI and REST)
 */

import { executeQuery } from '@kb-labs/mind-query';
import type { QueryName } from '@kb-labs/mind-types';
import { resolve } from 'node:path';
import { encode } from '@byjohann/toon';
import { join } from 'node:path';

/**
 * Normalized query input (independent of CLI/REST interface)
 */
export interface QueryCoreInput {
  /** Query name */
  query: string;
  /** Query parameters (parsed from CLI flags or HTTP body) */
  params: Record<string, any>;
  /** Execution options */
  options: {
    cwd: string;
    limit?: number;
    depth?: number;
    cacheTtl?: number;
    cacheMode?: 'local' | 'remote';
    noCache?: boolean;
    pathMode?: 'id' | 'relative' | 'absolute';
    aiMode?: boolean;
  };
  /** Output options */
  output?: {
    toonSidecar?: boolean;
    toonPath?: string;
  };
}

/**
 * Normalized query result (independent of CLI/REST interface)
 */
export interface QueryCoreResult {
  /** Query name */
  query: string;
  /** Query result */
  result: any;
  /** Query metadata */
  meta?: {
    queryId?: string;
    cached?: boolean;
    tokensEstimate?: number;
  };
  /** TOON sidecar path (if requested) */
  toonPath?: string;
}

/**
 * Runtime context for core functions (minimal interface)
 */
export interface QueryRuntimeContext {
  /** Working directory */
  workdir: string;
  /** Output directory */
  outdir?: string;
  /** File system access */
  fs: {
    mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
    writeFile: (path: string, data: string, encoding?: string) => Promise<void>;
  };
  /** Logging */
  log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) => void;
}

/**
 * Core query execution (shared between CLI and REST)
 * This is the single source of truth for query logic
 */
export async function runQueryCore(
  input: QueryCoreInput,
  ctx: QueryRuntimeContext
): Promise<QueryCoreResult> {
  const { query, params, options, output } = input;
  
  // Validate query name
  const validQueries = ['impact', 'scope', 'exports', 'externals', 'chain', 'meta', 'docs'];
  if (!validQueries.includes(query)) {
    throw new Error(`Invalid query name. Use: ${validQueries.join(', ')}`);
  }

  // Execute query
  const result = await executeQuery(query as QueryName, params, {
    cwd: options.cwd,
    limit: options.limit || 500,
    depth: options.depth || 5,
    cacheTtl: options.cacheTtl || 60,
    cacheMode: options.cacheMode || 'local',
    noCache: options.noCache ?? false,
    pathMode: options.pathMode || 'id',
    aiMode: options.aiMode ?? false,
  });

  // Handle TOON sidecar if requested
  let toonPath: string | undefined;
  if (output?.toonSidecar) {
    const toonOutput = encode(result);
    const sidecarDir = ctx.outdir 
      ? join(ctx.outdir, 'query')
      : join(ctx.workdir, '.kb', 'mind', 'query');
    
    await ctx.fs.mkdir(sidecarDir, { recursive: true });
    const sidecarPath = output.toonPath || join(sidecarDir, `${result.meta?.queryId || 'query'}.toon`);
    await ctx.fs.writeFile(sidecarPath, toonOutput, 'utf-8');
    toonPath = sidecarPath;
    
    ctx.log('info', `TOON sidecar written: ${sidecarPath}`);
  }

  return {
    query,
    result: result.result,
    meta: result.meta,
    toonPath,
  };
}

/**
 * Parse CLI flags into normalized query input
 */
export function parseQueryFromCliFlags(flags: Record<string, unknown>, cwd: string): QueryCoreInput {
  const queryName = flags.query as string;
  
  // Parse params based on query type
  const params: Record<string, any> = {};
  if (queryName === 'impact' || queryName === 'exports' || queryName === 'chain') {
    if (!flags.file) {
      throw new Error(`Query '${queryName}' requires file parameter`);
    }
    params.file = resolve(cwd, flags.file as string);
  } else if (queryName === 'scope') {
    if (!flags.path) {
      throw new Error(`Query 'scope' requires path parameter`);
    }
    params.path = resolve(cwd, flags.path as string);
  } else if (queryName === 'externals') {
    if (flags.scope) {
      params.scope = resolve(cwd, flags.scope as string);
    }
  } else if (queryName === 'meta') {
    if (flags.product) {
      params.product = flags.product as string;
    }
  } else if (queryName === 'docs') {
    if (flags.tag) { params.tag = flags.tag as string; }
    if (flags.type) { params.type = flags.type as string; }
    if (flags.filter) { params.search = flags.filter as string; }
  }

  return {
    query: queryName,
    params,
    options: {
      cwd,
      limit: flags.limit as number | undefined,
      depth: flags.depth as number | undefined,
      cacheTtl: flags.cacheTtl as number | undefined,
      cacheMode: flags.cacheMode as 'local' | 'remote' | undefined,
      noCache: flags.noCache as boolean | undefined,
      pathMode: flags.paths as 'id' | 'relative' | 'absolute' | undefined,
      aiMode: flags.aiMode as boolean | undefined,
    },
    output: {
      toonSidecar: flags.toonSidecar as boolean | undefined,
    },
  };
}

/**
 * Parse HTTP request into normalized query input
 */
export function parseQueryFromHttpRequest(request: {
  query: string;
  params?: Record<string, any>;
  options?: {
    cwd?: string;
    limit?: number;
    depth?: number;
    cacheTtl?: number;
    cacheMode?: 'local' | 'remote';
    noCache?: boolean;
    pathMode?: 'id' | 'relative' | 'absolute';
    aiMode?: boolean;
  };
}, defaultCwd: string): QueryCoreInput {
  if (!request.query) {
    throw new Error('Missing query parameter');
  }

  return {
    query: request.query,
    params: request.params || {},
    options: {
      cwd: request.options?.cwd || defaultCwd,
      limit: request.options?.limit,
      depth: request.options?.depth,
      cacheTtl: request.options?.cacheTtl,
      cacheMode: request.options?.cacheMode,
      noCache: request.options?.noCache,
      pathMode: request.options?.pathMode,
      aiMode: request.options?.aiMode,
    },
  };
}

