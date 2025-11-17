import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QdrantVectorStore } from '../qdrant.js';
import type { StoredMindChunk } from '../vector-store.js';
import type { RuntimeAdapter } from '../../adapters/runtime-adapter.js';

function createChunk(
  chunkId: string,
  text: string = 'test content',
): StoredMindChunk {
  return {
    chunkId,
    scopeId: 'test-scope',
    sourceId: 'test-source',
    path: 'test.ts',
    span: { startLine: 1, endLine: 2 },
    text,
    metadata: {},
    embedding: {
      dim: 1536,
      values: Array.from({ length: 1536 }, () => Math.random()),
    },
  };
}

function createMockRuntime(): RuntimeAdapter {
  return {
    fetch: vi.fn(),
    env: {
      get: vi.fn((key: string) => {
        if (key === 'QDRANT_URL') return 'http://localhost:6333';
        if (key === 'QDRANT_API_KEY') return 'test-key';
        return undefined;
      }),
    },
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      exists: vi.fn(),
    },
    log: vi.fn(),
    analytics: {
      track: vi.fn(),
      metric: vi.fn(),
    },
  };
}

describe('QdrantVectorStore', () => {
  let mockRuntime: RuntimeAdapter;

  beforeEach(() => {
    mockRuntime = createMockRuntime();
  });

  it('should create collection on first use', async () => {
    const store = new QdrantVectorStore({
      url: 'http://localhost:6333',
      apiKey: 'test-key',
      runtime: mockRuntime,
    });

    // Order of calls in replaceScope:
    // 1. deleteScope -> deletePoints (404 OK, collection doesn't exist)
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'not found',
    } as Response);

    // 2. ensureCollection -> getCollectionInfo (404, collection doesn't exist)
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'not found',
    } as Response);

    // 3. ensureCollection -> createCollection
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: true }),
      text: async () => '{}',
    } as Response);

    // 4. upsertPoints
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { status: 'completed' } }),
      text: async () => '{}',
    } as Response);

    const chunks: StoredMindChunk[] = [createChunk('chunk-1')];

    await store.replaceScope('test-scope', chunks);

    // Should create collection
    expect(mockRuntime.fetch).toHaveBeenCalled();
  });

  it('should store and search chunks', async () => {
    const store = new QdrantVectorStore({
      url: 'http://localhost:6333',
      apiKey: 'test-key',
      runtime: mockRuntime,
    });

    // Order of calls in replaceScope:
    // 1. deleteScope -> deletePoints
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: true }),
      text: async () => '{}',
    } as Response);

    // 2. ensureCollection -> getCollectionInfo (collection exists)
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { vectors_count: 0 } }),
      text: async () => '{}',
    } as Response);

    // 3. upsertPoints
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { status: 'completed' } }),
      text: async () => '{}',
    } as Response);

    const chunks: StoredMindChunk[] = [createChunk('chunk-1')];

    await store.replaceScope('test-scope', chunks);

    // Order of calls in search:
    // 1. ensureCollection -> getCollectionInfo (collection exists)
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { vectors_count: 0 } }),
      text: async () => '{}',
    } as Response);

    // 2. searchPoints
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: [
          {
            id: 'chunk-1',
            score: 0.9,
            payload: {
              chunkId: 'chunk-1',
              scopeId: 'test-scope',
              sourceId: 'test-source',
              path: 'test.ts',
              span: { startLine: 1, endLine: 2 },
              text: 'test content',
              metadata: {},
            },
          },
        ],
      }),
      text: async () => '{}',
    } as Response);

    const queryVector = {
      dim: 1536,
      values: Array.from({ length: 1536 }, () => Math.random()),
    };

    const results = await store.search('test-scope', queryVector, 10);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.chunk.chunkId).toBe('chunk-1');
  });

  it('should delete scope', async () => {
    const store = new QdrantVectorStore({
      url: 'http://localhost:6333',
      apiKey: 'test-key',
      runtime: mockRuntime,
    });

    // Mock collection deletion
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: true }),
    } as Response);

    await store.deleteScope('test-scope');

    expect(mockRuntime.fetch).toHaveBeenCalled();
  });

  it('should handle search errors', async () => {
    const store = new QdrantVectorStore({
      url: 'http://localhost:6333',
      apiKey: 'test-key',
      runtime: mockRuntime,
    });

    // Mock search error
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    } as Response);

    const queryVector = {
      dim: 1536,
      values: Array.from({ length: 1536 }, () => Math.random()),
    };

    await expect(
      store.search('test-scope', queryVector, 10),
    ).rejects.toThrow();
  });

  it('should filter by pathMatcher', async () => {
    const store = new QdrantVectorStore({
      url: 'http://localhost:6333',
      apiKey: 'test-key',
      runtime: mockRuntime,
    });

    const chunks: StoredMindChunk[] = [
      createChunk('chunk-1'),
      createChunk('chunk-2'),
    ];
    chunks[0]!.path = 'file1.ts';
    chunks[1]!.path = 'file2.js';

    // Order of calls in replaceScope:
    // 1. deleteScope -> deletePoints
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: true }),
      text: async () => '{}',
    } as Response);

    // 2. ensureCollection -> getCollectionInfo (collection exists)
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { vectors_count: 0 } }),
      text: async () => '{}',
    } as Response);

    // 3. upsertPoints
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { status: 'completed' } }),
      text: async () => '{}',
    } as Response);

    await store.replaceScope('test-scope', chunks);

    // Order of calls in search:
    // 1. ensureCollection -> getCollectionInfo (collection exists)
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { vectors_count: 0 } }),
      text: async () => '{}',
    } as Response);

    // 2. searchPoints with multiple results
    (mockRuntime.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: [
          {
            id: 'chunk-1',
            score: 0.9,
            payload: {
              chunkId: 'chunk-1',
              scopeId: 'test-scope',
              sourceId: 'test-source',
              path: 'file1.ts',
              span: { startLine: 1, endLine: 2 },
              text: 'content',
              metadata: {},
            },
          },
          {
            id: 'chunk-2',
            score: 0.8,
            payload: {
              chunkId: 'chunk-2',
              scopeId: 'test-scope',
              sourceId: 'test-source',
              path: 'file2.js',
              span: { startLine: 1, endLine: 2 },
              text: 'content',
              metadata: {},
            },
          },
        ],
      }),
      text: async () => '{}',
    } as Response);

    const queryVector = {
      dim: 1536,
      values: Array.from({ length: 1536 }, () => Math.random()),
    };

    const results = await store.search('test-scope', queryVector, 10, {
      pathMatcher: (path) => path.endsWith('.ts'),
    });

    // Should only return .ts files
    results.forEach(result => {
      expect(result.chunk.path).toMatch(/\.ts$/);
    });
  });
});

