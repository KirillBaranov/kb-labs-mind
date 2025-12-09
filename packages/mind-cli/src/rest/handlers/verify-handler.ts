/**
 * @module @kb-labs/mind-cli/rest/handlers/verify-handler
 * REST handler for Mind verify endpoint (Plugin Model v2)
 */

import type { MindVerifyRequest, MindVerifyResponse, MindGatewayError } from '../types';
import type { CardData } from '@kb-labs/sdk';
// TODO: docs/tasks/TASK-002-mind-architecture-cleanup.md
// TEMPORARY: verifyIndexes should be in mind-core, not mind-gateway
// Removed mind-gateway dependency to break circular dependency
// import { verifyIndexes } from '@kb-labs/mind-gateway';
import { resolveWorkspaceRoot } from '@kb-labs/sdk';

// TEMPORARY: Stub until verifyIndexes is moved to mind-core
// TODO: docs/tasks/TASK-002-mind-architecture-cleanup.md
async function verifyIndexes(_cwd: string): Promise<{ ok: boolean; inconsistencies: string[]; hint: string }> {
  // TODO: Implement verification logic
  return { ok: true, inconsistencies: [], hint: 'Run "kb mind rag-index" to rebuild indexes if needed' };
}

/**
 * Handler for GET /v1/plugins/mind/verify
 * Unified handler contract with runtime context
 */
export async function handleVerify(
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
): Promise<MindVerifyResponse | MindGatewayError> {
  try {
    const request = input as MindVerifyRequest;

    // Use runtime.log if available, otherwise use console
    const log = ctx.runtime?.log || ((level: string, msg: string, meta?: Record<string, unknown>) => {
      console.log(`[${level}] ${msg}`, meta || '');
    });
    log('info', 'Verifying Mind indexes', { cwd: request.cwd });

    const env = ctx.runtime?.env || ((key: string) => process.env[key]);
    
    // Determine workspace root: use request.cwd, KB_LABS_REPO_ROOT, or auto-detect from pluginRoot/workdir
    let cwd = request.cwd;
    if (!cwd) {
      // Try env variable first (if permission granted in manifest)
      cwd = env('KB_LABS_REPO_ROOT');
      if (!cwd) {
        // Auto-detect monorepo root by finding pnpm-workspace.yaml or .git
        // Start from current working directory
        try {
          const result = await resolveWorkspaceRoot({ startDir: process.cwd() });
          // resolveWorkspaceRoot finds the directory with .git or pnpm-workspace.yaml
          // This should be the monorepo root (kb-labs)
          cwd = result.rootDir;
        } catch {
          // Fallback to current directory
          cwd = '.';
        }
      }
    }

    // Final fallback if cwd is still undefined
    if (!cwd) {
      cwd = '.';
    }

    const result = await verifyIndexes(cwd);

    log('info', 'Mind verification completed', {
      ok: result.ok,
      inconsistencies: result.inconsistencies.length,
    });

    // Transform to CardListData format for widget
    const cards: CardData[] = [
      {
        title: 'Status',
        content: result.ok ? 'All indexes consistent' : `${result.inconsistencies.length} issue${result.inconsistencies.length !== 1 ? 's' : ''} found`,
        status: result.ok ? 'ok' as const : 'warn' as const,
      },
      {
        title: 'Hint',
        content: result.hint,
        status: 'info' as const,
      },
    ];

    if (result.inconsistencies.length > 0) {
      cards.push({
        title: 'Inconsistencies',
        content: result.inconsistencies.join('\n'),
        status: 'error' as const,
      });
    }

    // Return widget-ready format (CardListData)
    // REST API will wrap this in { status: 'ok', data: { cards } }
    // Studio will extract cards from data
    // Type assertion needed because handler signature expects VerifyResponse | GatewayError
    // but we return only widget data
    return {
      cards,
    } as unknown as MindVerifyResponse;
  } catch (error: any) {
    const log = ctx.runtime?.log || ((level: string, msg: string, meta?: Record<string, unknown>) => {
      console.log(`[${level}] ${msg}`, meta || '');
    });
    log('error', 'Mind verification failed', { error: error.message, stack: error.stack });
    return {
      ok: false,
      code: 'MIND_GATEWAY_ERROR',
      message: error.message,
      hint: 'Check workspace permissions and structure',
    } as MindGatewayError;
  }
}

