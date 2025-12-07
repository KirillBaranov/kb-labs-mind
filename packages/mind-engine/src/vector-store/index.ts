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
export type { LocalVectorStoreOptions } from './local';

import type { RuntimeAdapter } from '../adapters/runtime-adapter';
import { LocalVectorStore } from './local';
import type { VectorStore } from './vector-store';
import type { MindPlatformBindings } from '../platform/platform-adapters';
import { PlatformVectorStore } from '../platform/platform-vector-store';

export type VectorStoreType = 'local';

export interface VectorStoreConfig {
  type?: VectorStoreType;
  local?: {
    indexDir: string;
  };
}

/**
 * Create a vector store instance based on configuration
 */
export function createVectorStore(
  config: VectorStoreConfig,
  runtime: RuntimeAdapter,
  platform?: MindPlatformBindings,
): VectorStore {
  console.error('[DEBUG createVectorStore] platform exists:', !!platform);
  console.error('[DEBUG createVectorStore] platform.vectorStore exists:', !!platform?.vectorStore);
  console.error('[DEBUG createVectorStore] platform.vectorStore type:', platform?.vectorStore?.constructor?.name);

  if (platform?.vectorStore) {
    console.error('[DEBUG createVectorStore] Creating PlatformVectorStore (Qdrant)');
    console.error('[DEBUG createVectorStore] platform.storage exists:', !!platform.storage);
    console.error('[DEBUG createVectorStore] platform.storage type:', platform.storage?.constructor?.name);
    return new PlatformVectorStore({
      vectorStore: platform.vectorStore,
      storage: platform.storage,
      });
    }

      console.error('[DEBUG createVectorStore] Fallback to LocalVectorStore (files)');
      const indexDir = config.local?.indexDir ?? '.kb/mind/indexes';
      return new LocalVectorStore({ indexDir });
}

