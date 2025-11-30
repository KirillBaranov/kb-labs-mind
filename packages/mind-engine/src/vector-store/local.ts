/**
 * @module @kb-labs/mind-engine/vector-store/local
 * Local file-based vector store (wraps MindVectorStore)
 */

import type {
  StoredMindChunk,
  VectorSearchFilters,
  VectorSearchMatch,
  VectorStore,
} from './vector-store';
import {
  MindVectorStore,
  type StoredMindChunk as MindStoredMindChunk,
  type VectorSearchFilters as MindVectorSearchFilters,
  type VectorSearchMatch as MindVectorSearchMatch,
} from '@kb-labs/mind-vector-store';

export interface LocalVectorStoreOptions {
  indexDir: string;
}

/**
 * Local file-based vector store implementation
 */
export class LocalVectorStore implements VectorStore {
  private readonly store: MindVectorStore;

  constructor(options: LocalVectorStoreOptions) {
    this.store = new MindVectorStore({
      indexDir: options.indexDir,
    });
  }

  async replaceScope(scopeId: string, chunks: StoredMindChunk[]): Promise<void> {
    // Convert StoredMindChunk to MindStoredMindChunk (they should be compatible)
    const mindChunks: MindStoredMindChunk[] = chunks as unknown as MindStoredMindChunk[];
    await this.store.replaceScope(scopeId, mindChunks);
  }

  async search(
    scopeId: string,
    vector: Parameters<VectorStore['search']>[1],
    limit: number,
    filters?: VectorSearchFilters,
  ): Promise<VectorSearchMatch[]> {
    // Convert filters if needed
    const mindFilters: MindVectorSearchFilters | undefined = filters as unknown as MindVectorSearchFilters | undefined;
    const mindMatches: MindVectorSearchMatch[] = await this.store.search(scopeId, vector, limit, mindFilters);
    // Convert back to VectorSearchMatch
    return mindMatches as unknown as VectorSearchMatch[];
  }

  async getAllChunks(scopeId: string, filters?: VectorSearchFilters): Promise<StoredMindChunk[]> {
    // Access internal cache or load from file
    // MindVectorStore has a private cache, so we need to use search with a dummy vector
    // or access the file directly. For now, use search with large limit and dummy vector.
    const dummyVector = {
      dim: 384, // Default dimension
      values: new Array(384).fill(0),
    };
    const matches = await this.search(scopeId, dummyVector, 100000, filters);
    return matches.map(match => match.chunk);
  }
}

