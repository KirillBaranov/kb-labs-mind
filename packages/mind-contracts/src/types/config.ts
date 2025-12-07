import type { KnowledgeConfigInput } from '@kb-labs/knowledge-contracts';

/**
 * Registry configuration for Mind sync
 */
export interface MindSyncRegistryConfig {
  type: 'filesystem';
  path: string;
}

/**
 * Soft delete configuration for Mind sync
 */
export interface MindSyncSoftDeleteConfig {
  enabled: boolean;
  ttlDays: number;
}

/**
 * Partial updates configuration for Mind sync
 */
export interface MindSyncPartialUpdatesConfig {
  enabled: boolean;
}

/**
 * Batch processing configuration for Mind sync
 */
export interface MindSyncBatchConfig {
  maxSize: number;
}

/**
 * Mind synchronization configuration
 */
export interface MindSyncConfig {
  registry: MindSyncRegistryConfig;
  softDelete: MindSyncSoftDeleteConfig;
  partialUpdates: MindSyncPartialUpdatesConfig;
  batch: MindSyncBatchConfig;
}

/**
 * Mind-specific configuration that extends KnowledgeConfigInput
 * This includes all knowledge base config plus Mind-specific features
 */
export interface MindConfig extends KnowledgeConfigInput {
  /**
   * Synchronization settings for Mind
   */
  sync?: MindSyncConfig;
}

/**
 * Default sync configuration
 */
export const defaultMindSyncConfig: MindSyncConfig = {
  registry: {
    type: 'filesystem',
    path: '.kb/mind/sync/registry.json',
  },
  softDelete: {
    enabled: true,
    ttlDays: 30,
  },
  partialUpdates: {
    enabled: true,
  },
  batch: {
    maxSize: 100,
  },
};
