/**
 * Request and response types for Mind Gateway
 */

export interface QueryRequest {
  query: string;
  params: Record<string, any>;
  options?: {
    cwd?: string;
    limit?: number;
    depth?: number;
    cacheTtl?: number;
    noCache?: boolean;
    pathMode?: 'id' | 'absolute';
    aiMode?: boolean;
  };
}

export interface QueryResponse {
  ok: boolean;
  code: string | null;
  query: string;
  params: Record<string, any>;
  result: any;
  summary?: string;
  suggestNextQueries?: string[];
  schemaVersion: string;
  meta: {
    cwd: string;
    queryId: string;
    tokensEstimate: number;
    cached: boolean;
    truncated?: boolean;
    filesScanned: number;
    edgesTouched: number;
    depsHash: string;
    apiHash: string;
    timingMs: {
      load: number;
      filter: number;
      total: number;
    };
  };
  paths?: Record<string, string>;
}

export interface VerifyRequest {
  cwd?: string;
}

export interface VerifyResponse {
  ok: boolean;
  code: string | null;
  inconsistencies: string[];
  hint: string;
}

export interface GatewayError {
  ok: false;
  code: string;
  message: string;
  hint?: string;
}
