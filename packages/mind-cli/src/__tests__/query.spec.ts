/**
 * Unit tests for mind:query command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../cli/query.js';
import type { CommandContext } from '../cli/types.js';

// Mock dependencies
vi.mock('@kb-labs/mind-query', () => ({
  executeQuery: vi.fn()
}));

vi.mock('@kb-labs/shared-cli-ui', () => ({
  TimingTracker: vi.fn(() => ({
    checkpoint: vi.fn(),
    total: vi.fn(() => 50)
  })),
  formatTiming: vi.fn((ms) => `${ms}ms`),
  box: vi.fn((title, content) => `[${title}]\n${content.join('\n')}`),
  keyValue: vi.fn((pairs) => Object.entries(pairs).map(([k, v]) => `${k}: ${v}`))
}));

describe('Mind Query Command', () => {
  let mockContext: CommandContext;
  let mockPresenter: any;

  beforeEach(() => {
    mockPresenter = {
      write: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      json: vi.fn()
    };

    mockContext = {
      presenter: mockPresenter,
      cwd: '/test/project',
      flags: {},
      argv: []
    } as CommandContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should execute externals query successfully', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'externals',
      result: { externals: { 'react': ['src/index.ts'], 'typescript': ['src/config.ts'] }, count: 2 },
      meta: { cwd: '/test/project', cached: false, tokensEstimate: 100, timingMs: { total: 50 } },
      schemaVersion: '1.0'
    });

    const result = await run(mockContext, [], { query: 'externals' });

    expect(result).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('externals', {}, {
      cwd: '/test/project',
      limit: 500,
      depth: 5,
      cacheTtl: 60,
      cacheMode: 'local',
      noCache: false,
      pathMode: 'id',
      aiMode: false
    });
    expect(mockPresenter.write).toHaveBeenCalled();
  });

  it('should execute impact query with file parameter', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'impact',
      result: { importers: [{ file: 'src/index.ts', imports: ['Component'] }], count: 1 },
      meta: { cwd: '/test/project', cached: true, tokensEstimate: 50, timingMs: { total: 25 } },
      schemaVersion: '1.0'
    });

    const result = await run(mockContext, [], { 
      query: 'impact', 
      file: 'src/Component.tsx' 
    });

    expect(result).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('impact', { file: '/test/project/src/Component.tsx' }, expect.any(Object));
  });

  it('should execute scope query with path parameter', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'scope',
      result: { files: ['src/index.ts', 'src/utils.ts'], count: 2 },
      meta: { cwd: '/test/project', cached: false, tokensEstimate: 75, timingMs: { total: 30 } },
      schemaVersion: '1.0'
    });

    const result = await run(mockContext, [], { 
      query: 'scope', 
      path: 'src' 
    });

    expect(result).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('scope', { path: '/test/project/src' }, expect.any(Object));
  });

  it('should handle AI mode', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'meta',
      result: { version: '1.0', lastUpdated: '2024-01-01' },
      meta: { cwd: '/test/project', cached: false, tokensEstimate: 25, timingMs: { total: 15 } },
      schemaVersion: '1.0',
      summary: 'Project metadata',
      suggestNextQueries: ['query externals', 'query scope src']
    });

    const result = await run(mockContext, [], { 
      query: 'meta',
      'ai-mode': true
    });

    expect(result).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('meta', {}, expect.objectContaining({
      aiMode: true
    }));
    expect(mockPresenter.write).toHaveBeenCalledWith(
      expect.stringContaining('Summary: Project metadata')
    );
  });

  it('should handle JSON mode', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'externals',
      result: { externals: { 'react': ['src/index.ts'] }, count: 1 },
      meta: { cwd: '/test/project', cached: false, tokensEstimate: 50, timingMs: { total: 25 } },
      schemaVersion: '1.0'
    });

    const result = await run(mockContext, [], { query: 'externals', json: true });

    expect(result).toBe(0);
    expect(mockPresenter.write).toHaveBeenCalledWith(expect.stringContaining('"externals"'));
  });

  it('should handle compact JSON mode', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'externals',
      result: { externals: { 'react': ['src/index.ts'] }, count: 1 },
      meta: { cwd: '/test/project', cached: false, tokensEstimate: 50, timingMs: { total: 25 } },
      schemaVersion: '1.0'
    });

    const result = await run(mockContext, [], { query: 'externals', json: true, compact: true });

    expect(result).toBe(0);
    expect(mockPresenter.write).toHaveBeenCalledWith(expect.stringContaining('"externals"'));
  });

  it('should handle invalid query name', async () => {
    const result = await run(mockContext, [], { query: 'invalid' });

    expect(result).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Invalid query name');
    expect(mockPresenter.info).toHaveBeenCalledWith(
      'Available queries: impact, scope, exports, externals, chain, meta, docs'
    );
  });

  it('should handle missing required parameters', async () => {
    const result = await run(mockContext, [], { query: 'impact' });

    expect(result).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith("Query 'impact' requires --file flag");
  });

  it('should handle query execution errors', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockRejectedValue(new Error('Index not found'));

    const result = await run(mockContext, [], { query: 'externals' });

    expect(result).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Index not found');
  });

  it('should handle JSON mode errors', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockRejectedValue(new Error('Index not found'));

    const result = await run(mockContext, [], { query: 'externals', json: true });

    expect(result).toBe(1);
    expect(mockPresenter.json).toHaveBeenCalledWith({
      ok: false,
      code: 'MIND_QUERY_ERROR',
      message: 'Index not found'
    });
  });

  it('should handle custom cache settings', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'externals',
      result: { externals: {}, count: 0 },
      meta: { cwd: '/test/project', cached: false, tokensEstimate: 10, timingMs: { total: 5 } },
      schemaVersion: '1.0'
    });

    const result = await run(mockContext, [], { 
      query: 'externals',
      'cache-mode': 'ci',
      'cache-ttl': 300,
      'no-cache': true,
      limit: 100,
      depth: 3
    });

    expect(result).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('externals', {}, {
      cwd: '/test/project',
      limit: 100,
      depth: 3,
      cacheTtl: 300,
      cacheMode: 'ci',
      noCache: true,
      pathMode: 'id',
      aiMode: false
    });
  });

  it('should handle meta query with product flag', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'meta',
      params: { product: 'react-app' },
      result: { packages: [], totalPackages: 0 },
      schemaVersion: '1.0',
      meta: {
        cwd: '/test/project',
        queryId: 'meta-123',
        tokensEstimate: 50,
        cached: false,
        filesScanned: 0,
        edgesTouched: 0,
        depsHash: 'hash123',
        apiHash: 'hash456',
        timingMs: { load: 10, filter: 5, total: 15 }
      }
    });

    const result = await run(mockContext, ['meta'], { product: 'react-app' });

    expect(result).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('meta', { product: 'react-app' }, expect.any(Object));
  });

  it('should handle docs query with all flags', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'docs',
      params: { tag: 'api', type: 'function', search: 'test' },
      result: { docs: [], count: 0 },
      schemaVersion: '1.0',
      meta: {
        cwd: '/test/project',
        queryId: 'docs-123',
        tokensEstimate: 30,
        cached: false,
        filesScanned: 0,
        edgesTouched: 0,
        depsHash: 'hash123',
        apiHash: 'hash456',
        timingMs: { load: 5, filter: 2, total: 7 }
      }
    });

    const result = await run(mockContext, ['docs'], { 
      tag: 'api', 
      type: 'function', 
      filter: 'test' 
    });

    expect(result).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('docs', { 
      tag: 'api', 
      type: 'function', 
      search: 'test' 
    }, expect.any(Object));
  });
});
