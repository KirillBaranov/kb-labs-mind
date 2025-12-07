import type { IStorage, IVectorStore } from '@kb-labs/core-platform';
import type {
  StoredMindChunk,
  VectorSearchFilters,
  VectorSearchMatch,
  VectorStore,
} from '../vector-store/vector-store';

interface PlatformVectorStoreOptions {
  vectorStore: IVectorStore;
  storage?: IStorage;
  manifestPrefix?: string;
}

/**
 * Vector store adapter that persists Mind chunks via platform abstractions.
 *
 * Chunks are persisted in storage (if provided) for keyword search and metadata,
 * while vectors live in the platform vector store.
 */
export class PlatformVectorStore implements VectorStore {
  private readonly manifestCache = new Map<string, StoredMindChunk[]>();
  private readonly manifestPrefix: string;

  constructor(private readonly options: PlatformVectorStoreOptions) {
    this.manifestPrefix = options.manifestPrefix ?? 'mind/vector-index';
  }

  async replaceScope(scopeId: string, chunks: StoredMindChunk[]): Promise<void> {
    const fs = await import('node:fs/promises');
    const log = (msg: string) => fs.appendFile('/tmp/platform-vector-debug.log', msg + '\n');

    await log(`[replaceScope] START scopeId=${scopeId} chunks=${chunks.length}`);

    const existing = await this.loadScope(scopeId);
    await log(`[replaceScope] existing=${existing.length}`);

    if (existing.length) {
      const ids = existing.map(chunk => this.recordId(scopeId, chunk.chunkId));
      await log(`[replaceScope] Deleting ${ids.length} existing chunks from Qdrant`);
      await this.options.vectorStore.delete(ids);
      await log(`[replaceScope] Delete completed`);
    }

    if (chunks.length) {
      await log(`[replaceScope] Upserting ${chunks.length} chunks to Qdrant`);
      await log(`[replaceScope] vectorStore type: ${this.options.vectorStore.constructor.name}`);
      await log(`[replaceScope] vectorStore.upsert exists: ${typeof this.options.vectorStore.upsert}`);

      const records = chunks.map(chunk => ({
        id: this.recordId(scopeId, chunk.chunkId),
        vector: chunk.embedding.values,
        metadata: this.buildMetadata(scopeId, chunk),
      }));
      await log(`[replaceScope] Prepared ${records.length} records for upsert`);
      await log(`[replaceScope] Calling vectorStore.upsert NOW...`);

      await this.options.vectorStore.upsert(records);

      await log(`[replaceScope] Upsert completed successfully`);
    }

    await this.saveScope(scopeId, chunks);
    await log(`[replaceScope] saveScope completed - DONE`);
  }

  async updateScope(
    scopeId: string,
    chunks: StoredMindChunk[],
  ): Promise<void> {
    // For platform adapter we currently fallback to full replace
    await this.replaceScope(scopeId, chunks);
  }

  async upsertChunks(scopeId: string, chunks: StoredMindChunk[]): Promise<void> {
    const fs = await import('node:fs/promises');
    const log = (msg: string) => fs.appendFile('/tmp/platform-vector-debug.log', msg + '\n');

    await log(`[upsertChunks] START scopeId=${scopeId} newChunks=${chunks.length}`);
    const existing = await this.loadScope(scopeId);
    await log(`[upsertChunks] existing=${existing.length}`);
    const byId = new Map<string, StoredMindChunk>();
    for (const chunk of existing) {
      byId.set(chunk.chunkId, chunk);
    }
    for (const chunk of chunks) {
      byId.set(chunk.chunkId, chunk);
    }
    const merged = Array.from(byId.values());
    await log(`[upsertChunks] merged=${merged.length} calling replaceScope...`);
    await this.replaceScope(scopeId, merged);
    await log(`[upsertChunks] DONE`);
  }

  async search(
    scopeId: string,
    vector: Parameters<VectorStore['search']>[1],
    limit: number,
    filters?: VectorSearchFilters,
  ): Promise<VectorSearchMatch[]> {
    const scopeChunks = await this.loadScope(scopeId);
    if (scopeChunks.length === 0) {
      return [];
    }

    const results = await this.options.vectorStore.search(
      vector.values,
      Math.max(limit * 3, limit),
      { field: 'scopeId', operator: 'eq', value: scopeId },
    );

    const chunkMap = new Map(scopeChunks.map(chunk => [chunk.chunkId, chunk]));

    const matches: VectorSearchMatch[] = [];
    for (const result of results) {
      const chunkId = this.extractChunkId(scopeId, result.id, result.metadata);
      if (!chunkId) continue;
      const chunk = chunkMap.get(chunkId);
      if (!chunk) continue;
      if (!this.applyFilters(chunk, filters)) continue;
      matches.push({ chunk, score: result.score });
      if (matches.length >= limit) break;
    }
    return matches;
  }

  async deleteScope(scopeId: string): Promise<void> {
    const existing = await this.loadScope(scopeId);
    if (existing.length) {
      const ids = existing.map(chunk => this.recordId(scopeId, chunk.chunkId));
      await this.options.vectorStore.delete(ids);
    }
    await this.saveScope(scopeId, []);
  }

  async scopeExists(scopeId: string): Promise<boolean> {
    const cached = this.manifestCache.get(scopeId);
    if (cached) return true;
    if (!this.options.storage) return false;
    return this.options.storage.exists(this.manifestPath(scopeId));
  }

  async getAllChunks(scopeId: string, filters?: VectorSearchFilters): Promise<StoredMindChunk[]> {
    const chunks = await this.loadScope(scopeId);
    if (!filters) return chunks;
    return chunks.filter(chunk => this.applyFilters(chunk, filters));
  }

  private applyFilters(chunk: StoredMindChunk, filters?: VectorSearchFilters): boolean {
    if (!filters) return true;
    if (filters.sourceIds?.size && !filters.sourceIds.has(chunk.sourceId)) {
      return false;
    }
    if (filters.pathMatcher && !filters.pathMatcher(chunk.path)) {
      return false;
    }
    return true;
  }

  private recordId(scopeId: string, chunkId: string): string {
    return `${scopeId}:${chunkId}`;
  }

  private extractChunkId(scopeId: string, id: string, metadata?: Record<string, unknown>): string | null {
    if (metadata && typeof metadata.chunkId === 'string') {
      return metadata.chunkId;
    }
    if (id.startsWith(`${scopeId}:`)) {
      return id.slice(scopeId.length + 1);
    }
    return null;
  }

  private buildMetadata(scopeId: string, chunk: StoredMindChunk): Record<string, unknown> {
    return {
      scopeId,
      chunkId: chunk.chunkId,
      sourceId: chunk.sourceId,
      path: chunk.path,
      span: chunk.span,
      metadata: chunk.metadata,
    };
  }

  private manifestPath(scopeId: string): string {
    return `${this.manifestPrefix}/${scopeId}.json`;
  }

  private async loadScope(scopeId: string): Promise<StoredMindChunk[]> {
    const cached = this.manifestCache.get(scopeId);
    if (cached) {
      return cached;
    }

    if (!this.options.storage) {
      const chunks: StoredMindChunk[] = [];
      this.manifestCache.set(scopeId, chunks);
      return chunks;
    }

    const path = this.manifestPath(scopeId);
    const data = await this.options.storage.read(path);
    if (!data) {
      const chunks: StoredMindChunk[] = [];
      this.manifestCache.set(scopeId, chunks);
      return chunks;
    }

    try {
      const parsed = JSON.parse(data.toString('utf8')) as StoredMindChunk[];
      this.manifestCache.set(scopeId, parsed);
      return parsed;
    } catch {
      const chunks: StoredMindChunk[] = [];
      this.manifestCache.set(scopeId, chunks);
      return chunks;
    }
  }

  private async saveScope(scopeId: string, chunks: StoredMindChunk[]): Promise<void> {
    this.manifestCache.set(scopeId, chunks);
    if (!this.options.storage) {
      return;
    }
    const payload = JSON.stringify(chunks, null, 2);
    await this.options.storage.write(this.manifestPath(scopeId), Buffer.from(payload));
  }
}

