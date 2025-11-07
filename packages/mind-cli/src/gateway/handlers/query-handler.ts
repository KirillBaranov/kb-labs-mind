/**
 * @module @kb-labs/mind-cli/gateway/handlers/query-handler
 * REST handler for Mind query endpoint (Plugin Model v2)
 */

import type { QueryRequest, QueryResponse, GatewayError } from '@kb-labs/mind-gateway';
import type { InfoPanelSection } from '@kb-labs/plugin-manifest';
import { executeQuery } from '@kb-labs/mind-query';
import { findRepoRoot } from '@kb-labs/core';

/**
 * Handler for POST /v1/plugins/mind/query
 * Unified handler contract with runtime context
 */
export async function handleQuery(
  input: unknown,
  ctx: {
    requestId: string;
    pluginId: string;
    outdir?: string;
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
    runtime?: {
      fetch: typeof fetch;
      fs: any;
      env: (key: string) => string | undefined;
      log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) => void;
      invoke?: <T = unknown>(request: any) => Promise<any>;
      artifacts?: {
        read: (request: any) => Promise<Buffer | object>;
        write: (request: any) => Promise<{ path: string; meta: any }>;
      };
    };
  }
): Promise<QueryResponse | GatewayError> {
  try {
    const request = input as QueryRequest;

    // Use runtime.log if available, otherwise use console
    const log = ctx.runtime?.log || ((level: string, msg: string, meta?: Record<string, unknown>) => {
      console.log(`[${level}] ${msg}`, meta || '');
    });
    log('info', 'Executing Mind query', { query: request.query, params: request.params });

    // Validate request
    if (!request.query) {
      return {
        ok: false,
        code: 'MIND_BAD_REQUEST',
        message: 'Missing query parameter',
        hint: 'Provide a valid query name',
      };
    }

    if (!request.params) {
      return {
        ok: false,
        code: 'MIND_BAD_REQUEST',
        message: 'Missing params parameter',
        hint: 'Provide query parameters',
      };
    }

    // Get environment variables
    const env = ctx.runtime?.env || ((key: string) => process.env[key]);
    
    // Determine workspace root: use request.options.cwd, KB_LABS_REPO_ROOT, or auto-detect
    let repoRoot: string = request.options?.cwd || '';
    if (!repoRoot) {
      // Try env variable first (if permission granted in manifest)
      repoRoot = env('KB_LABS_REPO_ROOT') || '';
      if (!repoRoot) {
        // Auto-detect monorepo root by finding pnpm-workspace.yaml or .git
        // Start from current working directory
        try {
          const detectedRoot = await findRepoRoot(process.cwd());
          // findRepoRoot finds the directory with .git or pnpm-workspace.yaml
          // This should be the monorepo root (kb-labs)
          repoRoot = detectedRoot;
        } catch {
          // Fallback to current directory
          repoRoot = '.';
        }
      }
    }

    // Execute query
    const result = await executeQuery(
      request.query as any,
      request.params,
      {
        cwd: request.options?.cwd || repoRoot,
        limit: request.options?.limit || 500,
        depth: request.options?.depth || 5,
        cacheTtl: request.options?.cacheTtl || 60,
        noCache: request.options?.noCache || false,
        pathMode: request.options?.pathMode || 'id',
        aiMode: request.options?.aiMode || false,
      }
    );

    log('info', 'Mind query executed successfully', { query: request.query });

    // Transform to InfoPanelData format for widget
    const sections: InfoPanelSection[] = [
      {
        title: 'Query',
        data: {
          'Query Name': request.query,
          'Parameters': request.params,
        },
        format: 'keyvalue' as const,
      },
      {
        title: 'Result',
        data: result.result,
        format: 'json' as const,
        collapsible: true,
      },
      {
        title: 'Metadata',
        data: {
          'Files Scanned': result.meta.filesScanned,
          'Edges Touched': result.meta.edgesTouched,
          'Cached': result.meta.cached ? 'Yes' : 'No',
          'Total Time': `${result.meta.timingMs.total}ms`,
          'Load Time': `${result.meta.timingMs.load}ms`,
          'Filter Time': `${result.meta.timingMs.filter}ms`,
          'Query ID': result.meta.queryId,
          'Tokens Estimate': result.meta.tokensEstimate,
        },
        format: 'keyvalue' as const,
      },
    ];

    // Add summary if available
    if (result.summary) {
      sections.push({
        title: 'Summary',
        data: result.summary,
        format: 'text' as const,
      });
    }

    // Return widget-ready format (InfoPanelData)
    // REST API will wrap this in { status: 'ok', data: { sections } }
    // Studio will extract sections from data
    // Type assertion needed because handler signature expects QueryResponse | GatewayError
    // but we return only widget data
    return {
      sections,
    } as unknown as QueryResponse;
  } catch (error: any) {
    // Re-create log function in catch block (in case it's not in scope)
    const logError = ctx.runtime?.log || ((level: string, msg: string, meta?: Record<string, unknown>) => {
      console.log(`[${level}] ${msg}`, meta || '');
    });
    logError('error', 'Mind query execution failed', { error: error.message, stack: error.stack });
    return {
      ok: false,
      code: 'MIND_GATEWAY_ERROR',
      message: error.message,
      hint: 'Check query parameters and workspace state',
    };
  }
}

