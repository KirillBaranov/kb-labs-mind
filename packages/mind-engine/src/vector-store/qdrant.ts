/**
 * @module @kb-labs/mind-engine/vector-store/qdrant
 * Qdrant vector store implementation
 */

import { createHash } from 'node:crypto';
import type {
  EmbeddingVector,
} from '@kb-labs/knowledge-contracts';
import type { RuntimeAdapter } from '../adapters/runtime-adapter.js';
import type {
  StoredMindChunk,
  VectorSearchFilters,
  VectorSearchMatch,
  VectorStore,
} from './vector-store.js';

export interface QdrantVectorStoreOptions {
  url: string;
  apiKey?: string;
  collectionName?: string;
  dimension?: number;
  timeout?: number;
  runtime: RuntimeAdapter;
}

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: {
    scopeId: string;
    chunkId: string;
    sourceId: string;
    path: string;
    span: {
      startLine: number;
      endLine: number;
    };
    text: string;
    metadata?: Record<string, unknown>;
    fileHash?: string; // Content hash for change detection
    fileMtime?: number; // Modification time for change detection
  };
}

interface QdrantSearchRequest {
  vector: number[];
  limit: number;
  score_threshold?: number;
  filter?: {
    must?: Array<{
      key: string;
      match?: {
        value: string | string[];
      };
    }>;
  };
}

interface QdrantSearchResponse {
  result: Array<{
    id: string;
    score: number;
    payload: QdrantPoint['payload'];
  }>;
}

interface QdrantUpsertRequest {
  points: QdrantPoint[];
}

interface QdrantCollectionInfo {
  result: {
    vectors_count: number;
    indexed_vectors_count: number;
  };
}

/**
 * Convert a string to a deterministic UUID v4-like format
 * Qdrant requires point IDs to be either unsigned integers or UUIDs
 */
function stringToUUID(str: string): string {
  const hash = createHash('sha256').update(str).digest();
  // Format as UUID v4 (8-4-4-4-12 hex digits)
  const uuid = [
    hash.slice(0, 4).toString('hex'),
    hash.slice(4, 6).toString('hex'),
    hash.slice(6, 8).toString('hex'),
    hash.slice(8, 10).toString('hex'),
    hash.slice(10, 16).toString('hex'),
  ].join('-');
  return uuid;
}

/**
 * Qdrant vector store implementation
 */
export class QdrantVectorStore implements VectorStore {
  private readonly options: Required<Omit<QdrantVectorStoreOptions, 'apiKey'>> & {
    apiKey?: string;
  };
  private readonly collectionName: string;

  constructor(options: QdrantVectorStoreOptions) {
    this.options = {
      url: options.url.replace(/\/$/, ''), // Remove trailing slash
      apiKey: options.apiKey,
      collectionName: options.collectionName ?? 'mind_chunks',
      dimension: options.dimension ?? 1536,
      timeout: options.timeout ?? 30000,
      runtime: options.runtime,
    };
    this.collectionName = this.options.collectionName;
  }

  async replaceScope(scopeId: string, chunks: StoredMindChunk[]): Promise<void> {
    // Delete existing points for this scope
    await this.deleteScope(scopeId);

    if (chunks.length === 0) {
      this.options.runtime.log?.('info', `No chunks to store for scope ${scopeId}`);
      return;
    }

    // Ensure collection exists
    await this.ensureCollection();
    
    this.options.runtime.log?.('info', `Storing ${chunks.length} chunks for scope ${scopeId} in Qdrant`, {
      collectionName: this.collectionName,
      url: this.options.url,
    });

    // Convert chunks to Qdrant points
    const points: QdrantPoint[] = chunks.map(chunk => ({
      id: stringToUUID(`${scopeId}:${chunk.chunkId}`),
      vector: chunk.embedding.values,
      payload: {
        scopeId,
        chunkId: chunk.chunkId,
        sourceId: chunk.sourceId,
        path: chunk.path,
        span: {
          startLine: chunk.span.startLine,
          endLine: chunk.span.endLine,
        },
        text: chunk.text,
        metadata: chunk.metadata,
        fileHash: chunk.metadata?.fileHash as string | undefined,
        fileMtime: chunk.metadata?.fileMtime as number | undefined,
      },
    }));

    // Batch upsert (Qdrant supports up to 100 points per request)
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      // Debug: log first point structure
      if (i === 0 && batch.length > 0 && batch[0]) {
        const firstPoint = batch[0];
        this.options.runtime.log?.('info', 'Upserting batch to Qdrant', {
          batchSize: batch.length,
          firstPointId: firstPoint.id,
          firstPointHasPayload: !!firstPoint.payload,
          firstPointPayloadKeys: firstPoint.payload ? Object.keys(firstPoint.payload) : [],
          firstPointVectorLength: firstPoint.vector?.length,
        });
      }
      try {
      await this.upsertPoints(batch);
      } catch (error) {
        this.options.runtime.log?.('error', `Failed to upsert batch ${i / batchSize + 1}`, {
          error: error instanceof Error ? error.message : String(error),
          batchSize: batch.length,
        });
        throw error;
      }
    }
  }

  async updateScope(
    scopeId: string,
    chunks: StoredMindChunk[],
    fileMetadata?: Map<string, import('./vector-store.js').FileMetadata>,
  ): Promise<void> {
    // Ensure collection exists
    await this.ensureCollection();

    if (!fileMetadata || fileMetadata.size === 0) {
      // Fallback to full rebuild if no metadata provided
      this.options.runtime.log?.('info', `No file metadata provided, falling back to full rebuild for scope ${scopeId}`);
      return this.replaceScope(scopeId, chunks);
    }

    // Get existing chunks for this scope to compare
    const existingChunks = await this.getAllChunks(scopeId);
    const existingFiles = new Map<string, import('./vector-store.js').FileMetadata>();
    
    // Extract file metadata from existing chunks
    for (const chunk of existingChunks) {
      const existingMeta = chunk.metadata as { fileHash?: string; fileMtime?: number } | undefined;
      if (existingMeta?.fileHash && existingMeta?.fileMtime) {
        const currentMeta = existingFiles.get(chunk.path);
        // Keep the latest mtime if multiple chunks from same file
        if (!currentMeta || (existingMeta.fileMtime > (currentMeta.mtime ?? 0))) {
          existingFiles.set(chunk.path, {
            path: chunk.path,
            mtime: existingMeta.fileMtime,
            hash: existingMeta.fileHash,
          });
        }
      }
    }

    // Determine which files changed
    const changedFiles = new Set<string>();
    const deletedFiles = new Set<string>();
    
    // Check for changed or new files
    for (const [path, newMeta] of fileMetadata.entries()) {
      const existingMeta = existingFiles.get(path);
      if (!existingMeta || existingMeta.hash !== newMeta.hash || existingMeta.mtime !== newMeta.mtime) {
        changedFiles.add(path);
      }
    }
    
    // Check for deleted files
    for (const path of existingFiles.keys()) {
      if (!fileMetadata.has(path)) {
        deletedFiles.add(path);
      }
    }

    this.options.runtime.log?.('info', `Incremental update for scope ${scopeId}`, {
      totalFiles: fileMetadata.size,
      changedFiles: changedFiles.size,
      deletedFiles: deletedFiles.size,
      unchangedFiles: fileMetadata.size - changedFiles.size,
    });

    // Delete chunks from deleted files
    if (deletedFiles.size > 0) {
      const deletedPaths = Array.from(deletedFiles);
      await this.deletePoints({
        must: [
          {
            key: 'scopeId',
            match: { value: scopeId },
          },
          {
            key: 'path',
            match: { value: deletedPaths },
          },
        ],
      });
      this.options.runtime.log?.('info', `Deleted ${deletedFiles.size} files from scope ${scopeId}`);
    }

    // Delete chunks from changed files
    if (changedFiles.size > 0) {
      const changedPaths = Array.from(changedFiles);
      await this.deletePoints({
        must: [
          {
            key: 'scopeId',
            match: { value: scopeId },
          },
          {
            key: 'path',
            match: { value: changedPaths },
          },
        ],
      });
      this.options.runtime.log?.('info', `Deleted chunks from ${changedFiles.size} changed files`);
    }

    // Add new chunks only from changed files
    const chunksToAdd = chunks.filter(chunk => changedFiles.has(chunk.path));
    
    if (chunksToAdd.length === 0) {
      this.options.runtime.log?.('info', `No new chunks to add for scope ${scopeId}`);
      return;
    }

    // Convert chunks to Qdrant points
    const points: QdrantPoint[] = chunksToAdd.map(chunk => ({
      id: stringToUUID(`${scopeId}:${chunk.chunkId}`),
      vector: chunk.embedding.values,
      payload: {
        scopeId,
        chunkId: chunk.chunkId,
        sourceId: chunk.sourceId,
        path: chunk.path,
        span: {
          startLine: chunk.span.startLine,
          endLine: chunk.span.endLine,
        },
        text: chunk.text,
        metadata: chunk.metadata,
        fileHash: chunk.metadata?.fileHash as string | undefined,
        fileMtime: chunk.metadata?.fileMtime as number | undefined,
      },
    }));

    // Batch upsert (Qdrant supports up to 100 points per request)
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      try {
        await this.upsertPoints(batch);
      } catch (error) {
        this.options.runtime.log?.('error', `Failed to upsert batch ${i / batchSize + 1}`, {
          error: error instanceof Error ? error.message : String(error),
          batchSize: batch.length,
        });
        throw error;
      }
    }

    this.options.runtime.log?.('info', `Added ${chunksToAdd.length} new chunks from ${changedFiles.size} changed files`);
  }

  async search(
    scopeId: string,
    vector: EmbeddingVector,
    limit: number,
    filters?: VectorSearchFilters,
  ): Promise<VectorSearchMatch[]> {
    // Ensure collection exists
    await this.ensureCollection();

    // Build filter for scopeId
    const filter: QdrantSearchRequest['filter'] = {
      must: [
        {
          key: 'scopeId',
          match: { value: scopeId },
        },
      ],
    };

    // Add sourceId filters if provided
    if (filters?.sourceIds && filters.sourceIds.size > 0) {
      filter.must!.push({
        key: 'sourceId',
        match: { value: Array.from(filters.sourceIds) },
      });
    }

    // Build search request
    const searchRequest: QdrantSearchRequest = {
      vector: vector.values,
      limit,
      filter: filter.must!.length > 0 ? filter : undefined,
    };

    this.options.runtime.log?.('info', 'Searching Qdrant', {
      scopeId,
      vectorDimension: vector.values.length,
      limit,
      hasFilter: !!filter.must && filter.must.length > 0,
    });

    const response = await this.searchPoints(searchRequest);
    
    this.options.runtime.log?.('info', 'Qdrant search results', {
      resultsCount: response.result.length,
      firstResultScore: response.result[0]?.score,
      firstResultHasPayload: !!response.result[0]?.payload,
    });

    // Convert Qdrant results to VectorSearchMatch
    const matches: VectorSearchMatch[] = response.result
      .map((result, idx) => {
        // Validate payload exists
        if (!result.payload) {
          this.options.runtime.log?.('warn', `Result ${idx} has no payload`, {
            resultId: result.id,
            score: result.score,
          });
          return null;
        }

        // Apply path matcher filter if provided
        if (filters?.pathMatcher && result.payload.path && !filters.pathMatcher(result.payload.path)) {
          this.options.runtime.log?.('debug', `Result ${idx} filtered by pathMatcher`, {
            path: result.payload.path,
          });
          return null;
        }

        const chunk: StoredMindChunk = {
          chunkId: result.payload.chunkId,
          scopeId: result.payload.scopeId,
          sourceId: result.payload.sourceId,
          path: result.payload.path,
          span: {
            startLine: result.payload.span.startLine,
            endLine: result.payload.span.endLine,
          },
          text: result.payload.text,
          metadata: result.payload.metadata,
          embedding: {
            dim: vector.dim,
            values: vector.values, // Qdrant doesn't return vectors, use query vector as placeholder
          },
        };

        return {
          chunk,
          score: result.score,
        };
      })
      .filter((match): match is VectorSearchMatch => match !== null);

    this.options.runtime.log?.('info', 'Filtered search results', {
      totalResults: response.result.length,
      filteredMatches: matches.length,
      firstMatchScore: matches[0]?.score,
      firstMatchPath: matches[0]?.chunk.path,
    });

    return matches;
  }

  async deleteScope(scopeId: string): Promise<void> {
    try {
      // Delete points by filter
      const filter = {
        must: [
          {
            key: 'scopeId',
            match: { value: scopeId },
          },
        ],
      };

      await this.deletePoints(filter);
    } catch (error) {
      // Ignore errors if collection doesn't exist
      if (error instanceof Error && error.message.includes('not found')) {
        return;
      }
      throw error;
    }
  }

  async scopeExists(scopeId: string): Promise<boolean> {
    try {
      const filter = {
        must: [
          {
            key: 'scopeId',
            match: { value: scopeId },
          },
        ],
      };

      // Search with limit 1 to check if any points exist
      const searchRequest: QdrantSearchRequest = {
        vector: new Array(this.options.dimension).fill(0),
        limit: 1,
        filter,
      };

      const response = await this.searchPoints(searchRequest);
      return response.result.length > 0;
    } catch {
      return false;
    }
  }

  async getAllChunks(scopeId: string, filters?: VectorSearchFilters): Promise<StoredMindChunk[]> {
    // Use scroll API to get all points for a scope
    const filter: QdrantSearchRequest['filter'] = {
      must: [
        {
          key: 'scopeId',
          match: { value: scopeId },
        },
      ],
    };

    // Add sourceId filters if provided
    if (filters?.sourceIds && filters.sourceIds.size > 0) {
      filter.must!.push({
        key: 'sourceId',
        match: { value: Array.from(filters.sourceIds) },
      });
    }

    // Use search with large limit (Qdrant supports up to 10000 per request)
    const searchRequest: QdrantSearchRequest = {
      vector: new Array(this.options.dimension).fill(0),
      limit: 10000,
      filter: filter.must!.length > 0 ? filter : undefined,
    };

    const response = await this.searchPoints(searchRequest);

    // Convert to StoredMindChunk
    const chunks: StoredMindChunk[] = [];
    for (const result of response.result) {
      // Apply path matcher filter if provided
      if (filters?.pathMatcher && !filters.pathMatcher(result.payload.path)) {
        continue;
      }

      chunks.push({
        chunkId: result.payload.chunkId,
        scopeId: result.payload.scopeId,
        sourceId: result.payload.sourceId,
        path: result.payload.path,
        span: {
          startLine: result.payload.span.startLine,
          endLine: result.payload.span.endLine,
        },
        text: result.payload.text,
        metadata: result.payload.metadata ?? undefined,
        embedding: {
          dim: this.options.dimension,
          values: new Array(this.options.dimension).fill(0), // Dummy embedding
        },
      });
    }
    return chunks;
  }

  private async ensureCollection(): Promise<void> {
    try {
      // Check if collection exists
      await this.getCollectionInfo();
    } catch (error) {
      // Collection doesn't exist, create it
      if (error instanceof Error && error.message.includes('not found')) {
        await this.createCollection();
      } else {
        throw error;
      }
    }
  }

  private async createCollection(): Promise<void> {
    const url = `${this.options.url}/collections/${this.collectionName}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.options.apiKey) {
      headers['api-key'] = this.options.apiKey;
    }

    const body = {
      vectors: {
        size: this.options.dimension,
        distance: 'Cosine',
      },
    };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = typeof setTimeout !== 'undefined' ? setTimeout(() => controller?.abort(), this.options.timeout) : null;

    try {
      const response = await this.options.runtime.fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
        signal: controller?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create Qdrant collection: ${response.status} ${errorText}`);
      }
    } finally {
      if (timeoutId !== null && typeof clearTimeout !== 'undefined') {
        clearTimeout(timeoutId);
      }
    }
  }

  private async getCollectionInfo(): Promise<QdrantCollectionInfo> {
    const url = `${this.options.url}/collections/${this.collectionName}`;
    const headers: Record<string, string> = {};

    if (this.options.apiKey) {
      headers['api-key'] = this.options.apiKey;
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = typeof setTimeout !== 'undefined' ? setTimeout(() => controller?.abort(), this.options.timeout) : null;

    try {
      const response = await this.options.runtime.fetch(url, {
        method: 'GET',
        headers,
        signal: controller?.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Collection not found');
        }
        const errorText = await response.text();
        throw new Error(`Failed to get Qdrant collection info: ${response.status} ${errorText}`);
      }

      return await response.json() as QdrantCollectionInfo;
    } finally {
      if (timeoutId !== null && typeof clearTimeout !== 'undefined') {
        clearTimeout(timeoutId);
      }
    }
  }

  private async upsertPoints(points: QdrantPoint[]): Promise<void> {
    const url = `${this.options.url}/collections/${this.collectionName}/points?wait=true`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.options.apiKey) {
      headers['api-key'] = this.options.apiKey;
    }

    const body: QdrantUpsertRequest = { points };

    // Debug: verify body structure before sending
    if (points.length > 0 && points[0]) {
      this.options.runtime.log?.('info', 'Sending points to Qdrant', {
        url,
        pointsCount: points.length,
        firstPointId: points[0].id,
        firstPointHasPayload: !!points[0].payload,
        firstPointPayloadKeys: points[0].payload ? Object.keys(points[0].payload) : [],
        bodySize: JSON.stringify(body).length,
      });
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = typeof setTimeout !== 'undefined' ? setTimeout(() => controller?.abort(), this.options.timeout) : null;

    try {
      const response = await this.options.runtime.fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
        signal: controller?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Log error for debugging
        this.options.runtime.log?.('error', `Failed to upsert Qdrant points: ${response.status} ${errorText}`, {
          url,
          pointsCount: points.length,
          collectionName: this.collectionName,
          firstPointId: points[0]?.id,
          firstPointPayload: points[0]?.payload,
        });
        // If collection doesn't exist, ensureCollection should have created it
        // But if it still fails, throw error
        throw new Error(`Failed to upsert Qdrant points: ${response.status} ${errorText}`);
      }
      
      // Debug: verify upsert succeeded
      const responseText = await response.text();
      this.options.runtime.log?.('info', `Successfully upserted ${points.length} points to Qdrant`, {
        collectionName: this.collectionName,
        url,
        responseStatus: response.status,
        responseText: responseText.substring(0, 200), // First 200 chars
      });
    } finally {
      if (timeoutId !== null && typeof clearTimeout !== 'undefined') {
        clearTimeout(timeoutId);
      }
    }
  }

  private async searchPoints(request: QdrantSearchRequest): Promise<QdrantSearchResponse> {
    const url = `${this.options.url}/collections/${this.collectionName}/points/search`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.options.apiKey) {
      headers['api-key'] = this.options.apiKey;
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = typeof setTimeout !== 'undefined' ? setTimeout(() => controller?.abort(), this.options.timeout) : null;

    try {
      // Add with_payload to request
      const body = {
        ...request,
        with_payload: true,
        with_vector: false,
      };
      
      const response = await this.options.runtime.fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to search Qdrant points: ${response.status} ${errorText}`);
      }

      return await response.json() as QdrantSearchResponse;
    } finally {
      if (timeoutId !== null && typeof clearTimeout !== 'undefined') {
        clearTimeout(timeoutId);
      }
    }
  }

  private async deletePoints(filter: {
    must: Array<{
      key: string;
      match?: { value: string | string[] };
    }>;
  }): Promise<void> {
    const url = `${this.options.url}/collections/${this.collectionName}/points/delete`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.options.apiKey) {
      headers['api-key'] = this.options.apiKey;
    }

    const body = { filter };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = typeof setTimeout !== 'undefined' ? setTimeout(() => controller?.abort(), this.options.timeout) : null;

    try {
      const response = await this.options.runtime.fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Throw error with "not found" in message for deleteScope to catch
        if (response.status === 404) {
          throw new Error(`Collection not found: ${errorText}`);
        }
        throw new Error(`Failed to delete Qdrant points: ${response.status} ${errorText}`);
      }
    } finally {
      if (timeoutId !== null && typeof clearTimeout !== 'undefined') {
        clearTimeout(timeoutId);
      }
    }
  }
}

