/**
 * @module @kb-labs/mind-gateway/handlers/sync
 * REST API handlers for document synchronization
 */

import {
  runSyncAdd,
  runSyncUpdate,
  runSyncDelete,
  runSyncList,
  runSyncBatch,
  runSyncStatus,
  runSyncRestore,
  runSyncCleanup,
} from '@kb-labs/mind-cli/application/sync';
import { findRepoRoot } from '@kb-labs/core';

export interface SyncAddRequest {
  source: string;
  id: string;
  scopeId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SyncUpdateRequest {
  source: string;
  id: string;
  scopeId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SyncDeleteRequest {
  source: string;
  id: string;
  scopeId: string;
}

export interface SyncListRequest {
  source?: string;
  scopeId?: string;
  includeDeleted?: boolean;
}

export interface SyncBatchRequest {
  operations: Array<{
    operation: 'add' | 'update' | 'delete';
    source: string;
    id: string;
    scopeId: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }>;
  maxSize?: number;
}

export interface SyncRestoreRequest {
  source: string;
  id: string;
  scopeId: string;
}

export interface SyncCleanupRequest {
  source?: string;
  scopeId?: string;
  deletedOnly?: boolean;
  ttlDays?: number;
}

export interface SyncResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Get cwd from request or environment
 */
async function getCwd(request?: { options?: { cwd?: string } }): Promise<string> {
  if (request?.options?.cwd) {
    return request.options.cwd;
  }
  try {
    return await findRepoRoot(process.cwd());
  } catch {
    return process.cwd();
  }
}

/**
 * Handle sync add request
 */
export async function handleSyncAdd(
  input: unknown,
): Promise<SyncResponse> {
  try {
    const request = input as SyncAddRequest;
    const { source, id, scopeId, content, metadata } = request;
    const cwd = await getCwd();

    if (!source || !id || !scopeId || !content) {
      return {
        success: false,
        error: 'Missing required fields: source, id, scopeId, content',
      };
    }

    const result = await runSyncAdd({
      cwd,
      source,
      id,
      scopeId,
      content,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    return {
      success: result.success,
      result,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle sync update request
 */
export async function handleSyncUpdate(
  input: unknown,
): Promise<SyncResponse> {
  try {
    const request = input as SyncUpdateRequest;
    const { source, id, scopeId, content, metadata } = request;
    const cwd = await getCwd();

    if (!source || !id || !scopeId || !content) {
      return {
        success: false,
        error: 'Missing required fields: source, id, scopeId, content',
      };
    }

    const result = await runSyncUpdate({
      cwd,
      source,
      id,
      scopeId,
      content,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    return {
      success: result.success,
      result,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle sync delete request
 */
export async function handleSyncDelete(
  input: unknown,
): Promise<SyncResponse> {
  try {
    const request = input as SyncDeleteRequest;
    const { source, id, scopeId } = request;
    const cwd = await getCwd();

    if (!source || !id || !scopeId) {
      return {
        success: false,
        error: 'Missing required fields: source, id, scopeId',
      };
    }

    const result = await runSyncDelete({ cwd, source, id, scopeId });

    return {
      success: result.success,
      result,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle sync list request
 */
export async function handleSyncList(
  input: unknown,
): Promise<SyncResponse> {
  try {
    const request = (input as SyncListRequest) ?? {};
    const { source, scopeId, includeDeleted } = request;
    const cwd = await getCwd();

    const documents = await runSyncList({
      cwd,
      source,
      scopeId,
      includeDeleted,
    });

    return {
      success: true,
      result: { documents, total: documents.length },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle sync batch request
 */
export async function handleSyncBatch(
  input: unknown,
): Promise<SyncResponse> {
  try {
    const request = input as SyncBatchRequest;
    const { operations, maxSize } = request;
    const cwd = await getCwd();

    if (!operations || !Array.isArray(operations)) {
      return {
        success: false,
        error: 'Missing or invalid operations array',
      };
    }

    // Convert to SyncOperation format
    const syncOps = operations.map((op) => ({
      operation: op.operation,
      source: op.source,
      id: op.id,
      scopeId: op.scopeId,
      content: op.content,
      metadata: op.metadata,
    }));

    // Write to temporary file for batch processing
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const tempFile = path.join(os.tmpdir(), `sync-batch-${Date.now()}.json`);
    await fs.writeFile(tempFile, JSON.stringify({ operations: syncOps }), 'utf-8');

    try {
      const result = await runSyncBatch({ cwd, file: tempFile, maxSize });
      return {
        success: result.failed === 0,
        result,
      };
    } finally {
      // Cleanup temp file
      await fs.unlink(tempFile).catch(() => {
        // Ignore cleanup errors
      });
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle sync status request
 */
export async function handleSyncStatus(
  input: unknown,
): Promise<SyncResponse> {
  try {
    const request = (input as { source?: string; scopeId?: string }) ?? {};
    const { source, scopeId } = request;
    const cwd = await getCwd();

    const metrics = await runSyncStatus({ cwd, source, scopeId });

    return {
      success: true,
      result: metrics,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle sync restore request
 */
export async function handleSyncRestore(
  input: unknown,
): Promise<SyncResponse> {
  try {
    const request = input as SyncRestoreRequest;
    const { source, id, scopeId } = request;
    const cwd = await getCwd();

    if (!source || !id || !scopeId) {
      return {
        success: false,
        error: 'Missing required fields: source, id, scopeId',
      };
    }

    const result = await runSyncRestore({ cwd, source, id, scopeId });

    return {
      success: result.success,
      result,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle sync cleanup request
 */
export async function handleSyncCleanup(
  input: unknown,
): Promise<SyncResponse> {
  try {
    const request = (input as SyncCleanupRequest) ?? {};
    const { source, scopeId, deletedOnly, ttlDays } = request;
    const cwd = await getCwd();

    const result = await runSyncCleanup({
      cwd,
      source,
      scopeId,
      deletedOnly,
      ttlDays,
    });

    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

