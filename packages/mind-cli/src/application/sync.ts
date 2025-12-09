/**
 * @module @kb-labs/mind-cli/application/sync
 * Application layer for document synchronization
 */

import { findNearestConfig, readJsonWithDiagnostics } from '@kb-labs/sdk';
import {
  DocumentSyncAPI,
  createRegistry,
  syncBatch,
  calculateMetrics,
  type SyncConfig,
  type SyncOperation,
  type BatchSyncResult,
  type SyncMetrics,
  type DocumentRecord,
} from '@kb-labs/mind-engine';
import {
  createMindKnowledgeRuntime,
  type MindKnowledgeRuntime,
} from '../shared/knowledge';
import type { RuntimeAdapter } from '@kb-labs/mind-engine';

export interface SyncAddOptions {
  cwd: string;
  source: string;
  id: string;
  scopeId: string;
  content: string;
  contentFile?: string;
  metadata?: string; // JSON string
}

export interface SyncUpdateOptions {
  cwd: string;
  source: string;
  id: string;
  scopeId: string;
  content: string;
  contentFile?: string;
  metadata?: string; // JSON string
}

export interface SyncDeleteOptions {
  cwd: string;
  source: string;
  id: string;
  scopeId: string;
}

export interface SyncListOptions {
  cwd: string;
  source?: string;
  scopeId?: string;
  includeDeleted?: boolean;
}

export interface SyncBatchOptions {
  cwd: string;
  file: string;
  maxSize?: number;
}

export interface SyncStatusOptions {
  cwd: string;
  source?: string;
  scopeId?: string;
}

export interface SyncRestoreOptions {
  cwd: string;
  source: string;
  id: string;
  scopeId: string;
}

export interface SyncCleanupOptions {
  cwd: string;
  source?: string;
  scopeId?: string;
  deletedOnly?: boolean;
  ttlDays?: number;
}

/**
 * Create DocumentSyncAPI instance
 */
async function createSyncAPI(
  runtime: MindKnowledgeRuntime,
  cwd: string,
  scopeId: string,
): Promise<DocumentSyncAPI> {
  // Load sync config from kb.config.json
  const configResult = await findNearestConfig({
    startDir: cwd,
    filenames: ['kb.config.json'],
  });

  if (!configResult.path) {
    throw new Error(`kb.config.json not found in ${cwd} or parent directories`);
  }

  const jsonResult = await readJsonWithDiagnostics<{
    knowledge?: { sync?: SyncConfig };
    mind?: { sync?: SyncConfig };
  }>(configResult.path);

  if (!jsonResult.ok) {
    throw new Error(
      `Failed to read kb.config.json: ${jsonResult.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }

  const syncConfig = jsonResult.data.mind?.sync ?? jsonResult.data.knowledge?.sync ?? {};

  // Create registry
  const registryConfig = syncConfig.registry ?? {
    type: 'filesystem' as const,
    path: '.kb/mind/sync/registry.json',
  };
  const registry = createRegistry(registryConfig);

  // Get engine components by creating engine instance directly
  // We need vector store, embedding provider, and runtime adapter
  // Create engine factory and instantiate engine for the scope
  const mindEngineConfig = runtime.config.engines?.find(
    (e: any) => e.type === 'mind' && e.scopes?.includes(scopeId),
  );
  
  if (!mindEngineConfig) {
    throw new Error(
      `Mind engine not found for scope "${scopeId}" in knowledge configuration`,
    );
  }

  // Create engine factory and instantiate engine
  const { createMindKnowledgeEngineFactory } = await import('@kb-labs/mind-engine');
  const factory = createMindKnowledgeEngineFactory();
  const engineContext = {
    workspaceRoot: cwd,
    logger: (runtime.service as any).logger,
  };
  const engine = factory(mindEngineConfig, engineContext);

  // Access engine components (they are private, but we need them for sync)
  // Use type assertion to access private properties
  const vectorStore = (engine as any).vectorStore;
  const embeddingProvider = (engine as any).embeddingProvider;
  const runtimeAdapter = (engine as any).runtime;

  if (!vectorStore || !embeddingProvider || !runtimeAdapter) {
    throw new Error(
      'Failed to access vector store, embedding provider, or runtime from engine',
    );
  }

  return new DocumentSyncAPI({
    registry,
    vectorStore,
    embeddingProvider,
    runtime: runtimeAdapter,
    config: {
      softDelete: syncConfig.softDelete,
      partialUpdates: syncConfig.partialUpdates,
    },
  });
}

/**
 * Add a document
 */
export async function runSyncAdd(options: SyncAddOptions) {
  const runtime = await createMindKnowledgeRuntime({ cwd: options.cwd });
  const api = await createSyncAPI(runtime, options.cwd, options.scopeId);

  let content = options.content;
  if (options.contentFile) {
    const fs = await import('fs/promises');
    content = await fs.readFile(options.contentFile, 'utf-8');
  }

  let metadata;
  if (options.metadata) {
    metadata = JSON.parse(options.metadata);
  }

  return await api.addDocument({
    source: options.source,
    id: options.id,
    scopeId: options.scopeId,
    content,
    metadata,
  });
}

/**
 * Update a document
 */
export async function runSyncUpdate(options: SyncUpdateOptions) {
  const runtime = await createMindKnowledgeRuntime({ cwd: options.cwd });
  const api = await createSyncAPI(runtime, options.cwd, options.scopeId);

  let content = options.content;
  if (options.contentFile) {
    const fs = await import('fs/promises');
    content = await fs.readFile(options.contentFile, 'utf-8');
  }

  let metadata;
  if (options.metadata) {
    metadata = JSON.parse(options.metadata);
  }

  return await api.updateDocument({
    source: options.source,
    id: options.id,
    scopeId: options.scopeId,
    content,
    metadata,
  });
}

/**
 * Delete a document
 */
export async function runSyncDelete(options: SyncDeleteOptions) {
  const runtime = await createMindKnowledgeRuntime({ cwd: options.cwd });
  const api = await createSyncAPI(runtime, options.cwd, options.scopeId);

  return await api.deleteDocument({
    source: options.source,
    id: options.id,
    scopeId: options.scopeId,
  });
}

/**
 * List documents
 */
export async function runSyncList(options: SyncListOptions) {
  const runtime = await createMindKnowledgeRuntime({ cwd: options.cwd });
  // For list, we don't need a specific scope, use first available scope or empty string
  const scopeId = options.scopeId ?? runtime.config.scopes?.[0]?.id ?? '';
  const api = await createSyncAPI(runtime, options.cwd, scopeId);

  return await api.listDocuments({
    source: options.source,
    scopeId: options.scopeId,
    includeDeleted: options.includeDeleted,
  });
}

/**
 * Batch sync operations
 */
export async function runSyncBatch(
  options: SyncBatchOptions,
): Promise<BatchSyncResult> {
  const runtime = await createMindKnowledgeRuntime({ cwd: options.cwd });
  // For batch, we need to determine scope from operations or use first available
  // We'll use first available scope as default, operations can override
  const defaultScopeId = runtime.config.scopes?.[0]?.id ?? '';
  const api = await createSyncAPI(runtime, options.cwd, defaultScopeId);

  // Load operations from file
  const fs = await import('fs/promises');
  const content = await fs.readFile(options.file, 'utf-8');
  const data = JSON.parse(content) as { operations: SyncOperation[] };

  if (!Array.isArray(data.operations)) {
    throw new Error('Invalid batch file: operations must be an array');
  }

  // Load config for max size
  const configResult = await findNearestConfig({
    startDir: options.cwd,
    filenames: ['kb.config.json'],
  });

  let maxSize = options.maxSize;
  if (!maxSize && configResult.path) {
    const jsonResult = await readJsonWithDiagnostics<{
      knowledge?: { sync?: { batch?: { maxSize?: number; maxSizeOverride?: number } } };
    }>(configResult.path);
    if (jsonResult.ok) {
      maxSize =
        jsonResult.data.knowledge?.sync?.batch?.maxSizeOverride ??
        jsonResult.data.knowledge?.sync?.batch?.maxSize ??
        100;
    }
  }

  return await syncBatch(api, data.operations, {
    maxSize: maxSize ?? 100,
    maxSizeOverride: maxSize,
  });
}

/**
 * Get sync status/metrics
 */
export async function runSyncStatus(
  options: SyncStatusOptions,
): Promise<SyncMetrics> {
  // Load config and create registry directly for metrics
  const configResult = await findNearestConfig({
    startDir: options.cwd,
    filenames: ['kb.config.json'],
  });

  if (!configResult.path) {
    throw new Error(`kb.config.json not found`);
  }

  const jsonResult = await readJsonWithDiagnostics<{
    knowledge?: { sync?: SyncConfig };
    mind?: { sync?: SyncConfig };
  }>(configResult.path);

  if (!jsonResult.ok) {
    throw new Error('Failed to read config');
  }

  const syncConfig = jsonResult.data.mind?.sync ?? jsonResult.data.knowledge?.sync ?? {};
  const registryConfig = syncConfig.registry ?? {
    type: 'filesystem' as const,
    path: '.kb/mind/sync/registry.json',
  };
  const registry = createRegistry(registryConfig);

  return await calculateMetrics(registry);
}

/**
 * Restore a soft-deleted document
 */
export async function runSyncRestore(options: SyncRestoreOptions) {
  const runtime = await createMindKnowledgeRuntime({ cwd: options.cwd });
  const api = await createSyncAPI(runtime, options.cwd, options.scopeId);

  return await api.restoreDocument({
    source: options.source,
    id: options.id,
    scopeId: options.scopeId,
  });
}

/**
 * Cleanup soft-deleted documents
 */
export async function runSyncCleanup(options: SyncCleanupOptions) {
  const runtime = await createMindKnowledgeRuntime({ cwd: options.cwd });
  // For cleanup, use first available scope if not specified
  const scopeId = options.scopeId ?? runtime.config.scopes?.[0]?.id ?? '';
  const api = await createSyncAPI(runtime, options.cwd, scopeId);

  const records = await api.listDocuments({
    source: options.source,
    scopeId: options.scopeId,
    includeDeleted: true,
  });

  const ttlDays = options.ttlDays ?? 30;
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const toDelete = records.filter((record: DocumentRecord) => {
    if (!record.deleted) {
      return false;
    }
    if (!record.deletedAt) {
      return false;
    }
    const deletedAt = new Date(record.deletedAt).getTime();
    return now - deletedAt > ttlMs;
  });

  // Use hard delete for cleanup (bypass soft-delete)
  const results = await Promise.all(
    toDelete.map((record: DocumentRecord) =>
      api.hardDeleteDocument({
        source: record.source,
        id: record.id,
        scopeId: record.scopeId,
      }),
    ),
  );

  return {
    deleted: toDelete.length,
    results,
  };
}

