/**
 * Shared gateway request/response types used by Mind CLI handlers.
 * They mirror the contracts consumed by Studio widgets and REST gateway.
 */

export interface MindQueryRequest {
  query: string;
  params: Record<string, unknown>;
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

export interface MindQueryResponse {
  ok: boolean;
  code: string | null;
  query: string;
  params: Record<string, unknown>;
  result: unknown;
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

export interface MindVerifyRequest {
  cwd?: string;
}

export interface MindVerifyResponse {
  ok: boolean;
  code: string | null;
  inconsistencies: string[];
  hint: string;
}

export interface MindGatewayError {
  ok: false;
  code: string;
  message: string;
  hint?: string;
}

