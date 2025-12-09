/**
 * @module @kb-labs/mind-cli/rest/handlers/sync-handler
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
} from '../../application/sync';
import { findRepoRoot } from '@kb-labs/sdk';

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
}

export interface SyncStatusRequest {
  source?: string;
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

/**
 * Handler for POST /v1/plugins/mind/sync/add
 */
export async function handleSyncAdd(
  input: unknown,
  ctx: { cwd?: string; [key: string]: unknown },
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const request = input as SyncAddRequest;
    const cwd = (ctx.cwd as string) || (await findRepoRoot(process.cwd()));
    const result = await runSyncAdd({
      cwd,
      source: request.source,
      id: request.id,
      scopeId: request.scopeId,
      content: request.content,
      metadata: request.metadata ? JSON.stringify(request.metadata) : undefined,
    });
    return { ok: true, result };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Handler for POST /v1/plugins/mind/sync/update
 */
export async function handleSyncUpdate(
  input: unknown,
  ctx: { cwd?: string; [key: string]: unknown },
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const request = input as SyncUpdateRequest;
    const cwd = (ctx.cwd as string) || (await findRepoRoot(process.cwd()));
    const result = await runSyncUpdate({
      cwd,
      source: request.source,
      id: request.id,
      scopeId: request.scopeId,
      content: request.content,
      metadata: request.metadata ? JSON.stringify(request.metadata) : undefined,
    });
    return { ok: true, result };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Handler for POST /v1/plugins/mind/sync/delete
 */
export async function handleSyncDelete(
  input: unknown,
  ctx: { cwd?: string; [key: string]: unknown },
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const request = input as SyncDeleteRequest;
    const cwd = (ctx.cwd as string) || (await findRepoRoot(process.cwd()));
    const result = await runSyncDelete({
      cwd,
      source: request.source,
      id: request.id,
      scopeId: request.scopeId,
    });
    return { ok: true, result };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Handler for GET /v1/plugins/mind/sync/list
 */
export async function handleSyncList(
  input: unknown,
  ctx: { cwd?: string; [key: string]: unknown },
): Promise<{ ok: boolean; documents?: unknown[]; error?: string }> {
  try {
    const request = input as SyncListRequest;
    const cwd = (ctx.cwd as string) || (await findRepoRoot(process.cwd()));
    const documents = await runSyncList({
      cwd,
      source: request.source,
      scopeId: request.scopeId,
      includeDeleted: request.includeDeleted,
    });
    return { ok: true, documents };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Handler for POST /v1/plugins/mind/sync/batch
 */
export async function handleSyncBatch(
  input: unknown,
  ctx: { cwd?: string; [key: string]: unknown },
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const request = input as SyncBatchRequest;
    const cwd = (ctx.cwd as string) || (await findRepoRoot(process.cwd()));
    // Create temporary file for batch operations
    const fs = await import('fs/promises');
    const tmpFile = `/tmp/sync-batch-${Date.now()}.json`;
    await fs.writeFile(tmpFile, JSON.stringify({ operations: request.operations }), 'utf-8');
    try {
      const result = await runSyncBatch({
        cwd,
        file: tmpFile,
      });
      return { ok: true, result };
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Handler for GET /v1/plugins/mind/sync/status
 */
export async function handleSyncStatus(
  input: unknown,
  ctx: { cwd?: string; [key: string]: unknown },
): Promise<{ ok: boolean; metrics?: unknown; error?: string }> {
  try {
    const request = input as SyncStatusRequest;
    const cwd = (ctx.cwd as string) || (await findRepoRoot(process.cwd()));
    const metrics = await runSyncStatus({
      cwd,
      source: request.source,
    });
    return { ok: true, metrics };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Handler for POST /v1/plugins/mind/sync/restore
 */
export async function handleSyncRestore(
  input: unknown,
  ctx: { cwd?: string; [key: string]: unknown },
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const request = input as SyncRestoreRequest;
    const cwd = (ctx.cwd as string) || (await findRepoRoot(process.cwd()));
    const result = await runSyncRestore({
      cwd,
      source: request.source,
      id: request.id,
      scopeId: request.scopeId,
    });
    return { ok: true, result };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Handler for POST /v1/plugins/mind/sync/cleanup
 */
export async function handleSyncCleanup(
  input: unknown,
  ctx: { cwd?: string; [key: string]: unknown },
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const request = input as SyncCleanupRequest;
    const cwd = (ctx.cwd as string) || (await findRepoRoot(process.cwd()));
    const result = await runSyncCleanup({
      cwd,
      source: request.source,
      scopeId: request.scopeId,
      deletedOnly: request.deletedOnly,
      ttlDays: request.ttlDays,
    });
    return { ok: true, result };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

