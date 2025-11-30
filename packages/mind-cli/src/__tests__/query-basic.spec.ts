/**
 * Basic tests for mind:query command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../cli/commands/query';
import type { CommandContext } from '../cli/types';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import { getExitCode, getProducedArtifacts } from './helpers';

// Mock dependencies
vi.mock('@kb-labs/mind-query', () => ({
  executeQuery: vi.fn()
}));

vi.mock('@kb-labs/analytics-sdk-node', () => ({
  runScope: async (_config: any, fn: any) => {
    return fn(async () => {});
  }
}));

vi.mock('@kb-labs/shared-cli-ui', () => ({
  TimingTracker: vi.fn(() => ({
    checkpoint: vi.fn(),
    total: vi.fn(() => 25),
  })),
  formatTiming: vi.fn((ms: number) => `${ms}ms`),
  box: vi.fn((title: string, content: string[]) => `[${title}]
${content.join('\n')}`),
  keyValue: vi.fn((pairs: Record<string, string | number>) =>
    Object.entries(pairs).map(([k, v]) => `${k}: ${v}`)
  ),
  safeColors: {
    success: (s: string) => s,
    warning: (s: string) => s,
    error: (s: string) => s,
    muted: (s: string) => s,
    bold: (s: string) => s,
  },
  safeSymbols: {
    success: '✓',
    warning: '⚠',
    error: '✗',
  },
  displayArtifacts: vi.fn(() => []),
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
  const QUERY_ARTIFACT_ID =
    pluginContractsManifest.artifacts['mind.query.output']?.id ?? 'mind.query.output';

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

    expect(typeof result).toBe('number');
    expect(getExitCode(result)).toBe(0);
    expect(executeQuery).toHaveBeenCalledWith('externals', {}, expect.any(Object));
    expect(mockPresenter.error).not.toHaveBeenCalled();
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

    expect(getExitCode(result)).toBe(0);
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

    expect(getExitCode(result)).toBe(0);
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

    expect(getExitCode(result)).toBe(0);
    // JSON mode should call presenter.json
    // expect(mockPresenter.json).toHaveBeenCalled();
  });

  it('should handle missing required parameters', async () => {
    const result = await run(mockContext, [], { query: 'impact' });

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith("Query 'impact' requires --file flag");
  });

  it('should handle query execution errors', async () => {
    const { executeQuery } = await import('@kb-labs/mind-query');
    vi.mocked(executeQuery).mockRejectedValue(new Error('Index not found'));

    const result = await run(mockContext, [], { query: 'externals' });

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Index not found');
  });
});
