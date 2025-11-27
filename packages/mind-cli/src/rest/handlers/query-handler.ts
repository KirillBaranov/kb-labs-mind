/**
 * @module @kb-labs/mind-cli/rest/handlers/query-handler
 * REST handler for Mind query endpoint (Plugin Model v2)
 */

import type { MindQueryRequest, MindQueryResponse, MindGatewayError } from '../types.js';
import type { InfoPanelSection } from '@kb-labs/plugin-manifest';
import { findRepoRoot } from '@kb-labs/core';
import { runQueryCore, parseQueryFromHttpRequest, type QueryRuntimeContext } from '../../application/index.js';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';

const QUERY_ARTIFACT_ID =
  pluginContractsManifest.artifacts['mind.query.output']?.id ?? 'mind.query.output';

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
    logger?: {
      debug: (msg: string, meta?: Record<string, unknown>) => void;
      info: (msg: string, meta?: Record<string, unknown>) => void;
      warn: (msg: string, meta?: Record<string, unknown>) => void;
      error: (msg: string, meta?: Record<string, unknown>) => void;
    };
    runtime?: {
      fetch: typeof fetch;
      fs: any;
      env: (key: string) => string | undefined;
      /** @deprecated Use ctx.logger instead. Will be removed in v2.0 */
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
    // Transform widget data to MindQueryRequest format
    // Widgets send data as-is, we need to normalize it
    let request: MindQueryRequest;
    
    if (typeof input === 'string') {
      // InputDisplay widget sends just a string
      request = {
        query: input,
        params: {},
        options: {},
      };
    } else if (input && typeof input === 'object') {
      const data = input as Record<string, unknown>;
      
      // Check if it's already in MindQueryRequest format
      if ('query' in data && typeof data.query === 'string') {
        request = {
          query: data.query,
          params: (data.params as Record<string, unknown>) || {},
          options: (data.options as MindQueryRequest['options']) || {},
        };
      } else {
        // Form widget sends flat object with fields
        // Transform to MindQueryRequest format
        const query = (data.query as string) || '';
        const params: Record<string, unknown> = {};
        const options: MindQueryRequest['options'] = {};
        
        // Extract intent if present
        if (data.intent) {
          params.intent = data.intent;
        }
        
        // Extract options
        if (data.aiMode) {
          options.aiMode = Boolean(data.aiMode);
        }
        if (data.limit) {
          options.limit = Number(data.limit);
        }
        if (data.depth) {
          options.depth = Number(data.depth);
        }
        if (data.cacheTtl) {
          options.cacheTtl = Number(data.cacheTtl);
        }
        if (data.noCache) {
          options.noCache = Boolean(data.noCache);
        }
        if (data.pathMode) {
          options.pathMode = data.pathMode as 'id' | 'absolute';
        }
        if (data.cwd) {
          options.cwd = String(data.cwd);
        }
        
        request = {
          query,
          params,
          options: Object.keys(options).length > 0 ? options : undefined,
        };
      }
    } else {
      return {
        ok: false,
        code: 'MIND_BAD_REQUEST',
        message: 'Invalid request format',
        hint: 'Request must be a string or an object with query field',
      } as MindGatewayError;
    }
    
    ctx.logger?.info('Executing Mind query', { query: request.query, params: request.params });

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

    log('info', 'Mind query executed successfully', {
      query: request.query,
      produces: [QUERY_ARTIFACT_ID],
    });

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
    logError('error', 'Mind query execution failed', {
      error: error.message,
      stack: error.stack,
      produces: [QUERY_ARTIFACT_ID],
    });
    return {
      ok: false,
      code: 'MIND_GATEWAY_ERROR',
      message: error.message,
      hint: 'Check query parameters and workspace state',
    } as MindGatewayError;
  }
}

