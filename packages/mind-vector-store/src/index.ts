import path from 'node:path';
import fs from 'fs-extra';
import type {
  EmbeddingVector,
  SpanRange,
} from '@kb-labs/knowledge-contracts';

export interface StoredMindChunk {
  chunkId: string;
  scopeId: string;
  sourceId: string;
  path: string;
  span: SpanRange;
  text: string;
  metadata?: Record<string, unknown>;
  embedding: EmbeddingVector;
}

export interface MindVectorStoreOptions {
  indexDir: string;
}

export interface VectorSearchFilters {
  sourceIds?: Set<string>;
  pathMatcher?: (filePath: string) => boolean;
}

export interface VectorSearchMatch {
  chunk: StoredMindChunk;
  score: number;
}

interface ScopeIndexFile {
  scopeId: string;
  generatedAt: string;
  chunks: StoredMindChunk[];
}

export class MindVectorStore {
  private readonly options: MindVectorStoreOptions;
  private readonly cache = new Map<string, StoredMindChunk[]>();

  constructor(options: MindVectorStoreOptions) {
    this.options = options;
  }

  async replaceScope(
    scopeId: string,
    chunks: StoredMindChunk[],
  ): Promise<void> {
    this.cache.set(scopeId, chunks);
    await fs.ensureDir(this.options.indexDir);
    const filePath = this.getScopePath(scopeId);
    const payload: ScopeIndexFile = {
      scopeId,
      generatedAt: new Date().toISOString(),
      chunks,
    };
    await fs.writeJson(filePath, payload, { spaces: 2 });
  }

  async search(
    scopeId: string,
    vector: EmbeddingVector,
    limit: number,
    filters?: VectorSearchFilters,
  ): Promise<VectorSearchMatch[]> {
    const records = await this.loadScope(scopeId);
    if (records.length === 0) {
      return [];
    }

    const matches = records
      .filter(chunk => applyFilters(chunk, filters))
      .map(chunk => ({
        chunk,
        score: cosineSimilarity(vector, chunk.embedding),
      }))
      .filter(match => Number.isFinite(match.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return matches;
  }

  private async loadScope(scopeId: string): Promise<StoredMindChunk[]> {
    const cached = this.cache.get(scopeId);
    if (cached) {
      return cached;
    }

    const filePath = this.getScopePath(scopeId);
    if (!(await fs.pathExists(filePath))) {
      this.cache.set(scopeId, []);
      return [];
    }

    const payload = (await fs.readJson(filePath)) as ScopeIndexFile;
    this.cache.set(scopeId, payload.chunks);
    return payload.chunks;
  }

  private getScopePath(scopeId: string): string {
    const safeId = scopeId.replace(/[\\/]/g, '_');
    return path.join(this.options.indexDir, `${safeId}.json`);
  }
}

function applyFilters(
  chunk: StoredMindChunk,
  filters?: VectorSearchFilters,
): boolean {
  if (!filters) {
    return true;
  }
  if (
    filters.sourceIds?.size &&
    !filters.sourceIds.has(chunk.sourceId)
  ) {
    return false;
  }
  if (filters.pathMatcher && !filters.pathMatcher(chunk.path)) {
    return false;
  }
  return true;
}

function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.dim !== b.dim) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.values.length; i++) {
    const av = a.values[i] ?? 0;
    const bv = b.values[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / Math.sqrt(normA * normB);
}
