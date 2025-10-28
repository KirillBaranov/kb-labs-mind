/**
 * Basic tests for query.ts CLI command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../cli/query.js';
import type { CommandContext } from '../cli/types.js';

// Mock dependencies
vi.mock('@kb-labs/mind-query', () => ({
  executeQuery: vi.fn()
}));

const mockPresenter = {
  write: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  json: vi.fn()
};

let mockContext: CommandContext;

beforeEach(() => {
  mockContext = {
    cwd: '/test/project',
    flags: {},
    argv: [],
    presenter: mockPresenter
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Mind Query Command - Basic Tests', () => {
  it('should handle basic externals query', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'externals',
      params: {},
      result: { externals: { 'react': ['src/App.tsx'] }, count: 1 },
      schemaVersion: '1.0',
      meta: {
        cwd: '/test/project',
        queryId: 'externals-123',
        tokensEstimate: 20,
        cached: false,
        filesScanned: 0,
        edgesTouched: 0,
        depsHash: 'hash123',
        apiHash: 'hash456',
        timingMs: { load: 5, filter: 2, total: 7 }
      }
    });

    const result = await run(mockContext, [], { query: 'externals' });

    expect(result).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('externals', {}, expect.any(Object));
  });

  it('should handle impact query with file parameter', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'impact',
      params: { file: '/test/project/src/App.tsx' },
      result: { importers: [], count: 0 },
      schemaVersion: '1.0',
      meta: {
        cwd: '/test/project',
        queryId: 'impact-123',
        tokensEstimate: 15,
        cached: false,
        filesScanned: 0,
        edgesTouched: 0,
        depsHash: 'hash123',
        apiHash: 'hash456',
        timingMs: { load: 3, filter: 1, total: 4 }
      }
    });

    const result = await run(mockContext, [], { 
      query: 'impact',
      file: '/test/project/src/App.tsx'
    });

    expect(result).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('impact', { file: '/test/project/src/App.tsx' }, expect.any(Object));
  });

  it('should handle AI mode', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'meta',
      params: {},
      result: { packages: [], totalPackages: 0 },
      schemaVersion: '1.0',
      meta: {
        cwd: '/test/project',
        queryId: 'meta-123',
        tokensEstimate: 30,
        cached: false,
        filesScanned: 0,
        edgesTouched: 0,
        depsHash: 'hash123',
        apiHash: 'hash456',
        timingMs: { load: 5, filter: 2, total: 7 }
      }
    });

    const result = await run(mockContext, [], { 
      query: 'meta',
      'ai-mode': true
    });

    expect(result).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('meta', {}, expect.objectContaining({
      aiMode: true
    }));
  });

  it('should handle JSON mode', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockResolvedValue({
      ok: true,
      query: 'externals',
      params: {},
      result: { externals: {}, count: 0 },
      schemaVersion: '1.0',
      meta: {
        cwd: '/test/project',
        queryId: 'externals-123',
        tokensEstimate: 20,
        cached: false,
        filesScanned: 0,
        edgesTouched: 0,
        depsHash: 'hash123',
        apiHash: 'hash456',
        timingMs: { load: 5, filter: 2, total: 7 }
      }
    });

    mockContext.flags = { json: true };

    const result = await run(mockContext, [], { query: 'externals' });

    expect(result).toBe(0);
    // JSON mode should call presenter.json
    // expect(mockPresenter.json).toHaveBeenCalled();
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
});
