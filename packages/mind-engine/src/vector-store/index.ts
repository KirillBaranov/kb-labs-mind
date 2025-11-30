/**
 * @module @kb-labs/mind-engine/vector-store
 * Vector store factory and implementations
 */

export type {
  StoredMindChunk,
  VectorSearchFilters,
  VectorSearchMatch,
  VectorStore,
} from './vector-store';

// Re-export EmbeddingVector for convenience
export type { EmbeddingVector } from '@kb-labs/knowledge-contracts';

export { LocalVectorStore } from './local';
export { QdrantVectorStore } from './qdrant';
export type { LocalVectorStoreOptions } from './local';
export type { QdrantVectorStoreOptions } from './qdrant';

import type { RuntimeAdapter } from '../adapters/runtime-adapter';
import { LocalVectorStore } from './local';
import { QdrantVectorStore } from './qdrant';
import type { VectorStore } from './vector-store';

export type VectorStoreType = 'auto' | 'local' | 'qdrant';

export interface VectorStoreConfig {
  type?: VectorStoreType;
  local?: {
    indexDir: string;
  };
  qdrant?: {
    url: string;
    apiKey?: string;
    collectionName?: string;
    dimension?: number;
    timeout?: number;
  };
}

/**
 * Create a vector store instance based on configuration
 */
export function createVectorStore(
  config: VectorStoreConfig,
  runtime: RuntimeAdapter,
): VectorStore {
  const type = config.type ?? 'auto';

  // Auto mode: try Qdrant first if configured, fallback to local
  if (type === 'auto') {
    const qdrantUrl = runtime.env.get('QDRANT_URL') ?? config.qdrant?.url;
    if (qdrantUrl) {
      return new QdrantVectorStore({
        url: qdrantUrl,
        apiKey: runtime.env.get('QDRANT_API_KEY') ?? config.qdrant?.apiKey,
        collectionName: config.qdrant?.collectionName,
        dimension: config.qdrant?.dimension,
        timeout: config.qdrant?.timeout,
        runtime,
      });
    }

    // Fallback to local
    const indexDir = config.local?.indexDir ?? '.kb/mind/indexes';
    return new LocalVectorStore({ indexDir });
  }

  // Explicit type selection
  switch (type) {
    case 'qdrant': {
      const qdrantUrl = runtime.env.get('QDRANT_URL') ?? config.qdrant?.url;
      if (!qdrantUrl) {
        throw new Error('Qdrant URL is required. Set QDRANT_URL environment variable or provide in config.');
      }
      return new QdrantVectorStore({
        url: qdrantUrl,
        apiKey: runtime.env.get('QDRANT_API_KEY') ?? config.qdrant?.apiKey,
        collectionName: config.qdrant?.collectionName,
        dimension: config.qdrant?.dimension,
        timeout: config.qdrant?.timeout,
        runtime,
      });
    }

    case 'local': {
      const indexDir = config.local?.indexDir ?? '.kb/mind/indexes';
      return new LocalVectorStore({ indexDir });
    }

    default:
      throw new Error(`Unknown vector store type: ${type}`);
  }
}

