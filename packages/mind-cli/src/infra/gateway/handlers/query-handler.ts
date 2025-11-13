/**
 * @module @kb-labs/mind-cli/gateway/handlers/query-handler
 * REST handler for Mind query endpoint (Plugin Model v2)
 */

import type { MindQueryRequest, MindQueryResponse, MindGatewayError } from '../types.js';
import type { InfoPanelSection } from '@kb-labs/plugin-manifest';
import { findRepoRoot } from '@kb-labs/core';
import { runQueryCore, parseQueryFromHttpRequest, type QueryRuntimeContext } from '@app/application';

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
): Promise<MindQueryResponse | MindGatewayError> {
  try {
    const request = input as MindQueryRequest;
    const log = ctx.runtime?.log || ((level: string, msg: string, meta?: Record<string, unknown>) => {
      console.log(`[${level}] ${msg}`, meta || '');
    });

    log('info', 'Executing Mind query', { query: request.query, params: request.params });

    const env = ctx.runtime?.env || ((key: string) => process.env[key]);
    let repoRoot = request.options?.cwd || env('KB_LABS_REPO_ROOT') || '';
    if (!repoRoot) {
      try {
        repoRoot = await findRepoRoot(process.cwd());
      } catch {
        repoRoot = '.';
      }
    }

    const normalizedInput = parseQueryFromHttpRequest(request, repoRoot);

    const runtimeContext: QueryRuntimeContext = {
      workdir: repoRoot,
      outdir: ctx.outdir || repoRoot,
      fs: {
        mkdir: (path, options) => ctx.runtime?.fs?.mkdir(path, options) ?? Promise.resolve(),
        writeFile: (path, data, encoding) =>
          ctx.runtime?.fs?.writeFile?.(path, data, encoding) ?? Promise.resolve(),
      },
      log: (level, message, meta) => log(level, message, meta),
    };

    const result = await runQueryCore(normalizedInput, runtimeContext);

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
          'Files Scanned': result.meta?.filesScanned,
          'Edges Touched': result.meta?.edgesTouched,
          'Cached': result.meta?.cached ? 'Yes' : 'No',
          'Total Time': result.meta ? `${result.meta.timingMs.total}ms` : 'n/a',
          'Load Time': result.meta ? `${result.meta.timingMs.load}ms` : 'n/a',
          'Filter Time': result.meta ? `${result.meta.timingMs.filter}ms` : 'n/a',
          'Query ID': result.meta?.queryId,
          'Tokens Estimate': result.meta?.tokensEstimate,
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
    return {
      sections,
    } as unknown as MindQueryResponse;
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
    } as MindGatewayError;
  }
}

