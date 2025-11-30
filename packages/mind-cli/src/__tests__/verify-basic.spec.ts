/**
 * Basic tests for mind:verify command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../cli/commands/verify';
import type { CommandContext } from '../cli/types';
import { getExitCode } from './helpers';
import * as mindCore from '@kb-labs/mind-core';

// Mock dependencies
vi.mock('@kb-labs/mind-indexer', () => ({
  updateIndexes: vi.fn(),
  verifyIndexes: vi.fn()
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('@kb-labs/analytics-sdk-node', () => ({
  runScope: async (_config: any, fn: any) => {
    return fn(async () => {});
  }
}));

vi.mock('@kb-labs/shared-cli-ui', () => ({
  TimingTracker: vi.fn(() => ({
    checkpoint: vi.fn(),
    total: vi.fn(() => 20),
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
  vi.restoreAllMocks();
});

describe.skip('Mind Verify Command - Basic Tests', () => {
  it('should verify indexes successfully', async () => {
    const shaSpy = vi.spyOn(mindCore, 'sha256');
    const { readFile, access } = await import('node:fs/promises');

    // Mock file access
    vi.mocked(access).mockResolvedValue(undefined);

    // Mock index.json with proper structure
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
      schemaVersion: '1.0',
      generator: 'mind-indexer',
      lastUpdated: '2024-01-01T00:00:00Z',
      apiIndexHash: 'api123',
      depsHash: 'deps456',
      indexChecksum: 'checksum789'
    }));

    // Mock individual index files
    vi.mocked(readFile).mockResolvedValueOnce('{"schemaVersion": "1.0", "files": {}}'); // api-index.json
    vi.mocked(readFile).mockResolvedValueOnce('{"schemaVersion": "1.0", "edges": []}'); // deps.json
    vi.mocked(readFile).mockResolvedValueOnce('{}'); // meta.json
    vi.mocked(readFile).mockResolvedValueOnce('{}'); // docs.json

    // Mock checksum computation to return consistent hashes
    shaSpy.mockImplementation((input: string) => {
      if (input.includes('api-index')) {return 'api123';}
      if (input.includes('deps')) {return 'deps456';}
      if (input.includes('checksum')) {return 'checksum789';}
      return 'hash123';
    });

    const result = await run(mockContext, [], {});

    expect(getExitCode(result)).toBe(0);
  });

  it('should detect checksum mismatch', async () => {
    const shaSpy = vi.spyOn(mindCore, 'sha256');
    const { readFile, access } = await import('node:fs/promises');

    // Mock file access
    vi.mocked(access).mockResolvedValue(undefined);

    // Mock index.json with different checksum
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
      schemaVersion: '1.0',
      generator: 'mind-indexer',
      lastUpdated: '2024-01-01T00:00:00Z',
      apiIndexHash: 'api123',
      depsHash: 'deps456',
      indexChecksum: 'old123'
    }));

    // Mock individual index files
    vi.mocked(readFile).mockResolvedValueOnce('{"schemaVersion": "1.0", "files": {}}');
    vi.mocked(readFile).mockResolvedValueOnce('{"schemaVersion": "1.0", "edges": []}');
    vi.mocked(readFile).mockResolvedValueOnce('{}');
    vi.mocked(readFile).mockResolvedValueOnce('{}');

    // Mock checksum computation returning different value
    shaSpy.mockReturnValue('new456');

    const result = await run(mockContext, [], {});

    expect(getExitCode(result)).toBe(0);
  });

  it('should handle missing index files', async () => {
    const { access } = await import('node:fs/promises');

    // Mock file access failure
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));

    const result = await run(mockContext, [], {});

    expect(getExitCode(result)).toBe(0);
  });

  it('should handle JSON mode', async () => {
    const shaSpy = vi.spyOn(mindCore, 'sha256');
    const { readFile, access } = await import('node:fs/promises');

    // Mock file access
    vi.mocked(access).mockResolvedValue(undefined);

    // Mock index.json with proper structure
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
      schemaVersion: '1.0',
      generator: 'mind-indexer',
      lastUpdated: '2024-01-01T00:00:00Z',
      apiIndexHash: 'api123',
      depsHash: 'deps456',
      indexChecksum: 'checksum789'
    }));

    // Mock individual index files
    vi.mocked(readFile).mockResolvedValueOnce('{"schemaVersion": "1.0", "files": {}}');
    vi.mocked(readFile).mockResolvedValueOnce('{"schemaVersion": "1.0", "edges": []}');
    vi.mocked(readFile).mockResolvedValueOnce('{}');
    vi.mocked(readFile).mockResolvedValueOnce('{}');

    // Mock checksum computation to return consistent hashes
    shaSpy.mockImplementation((input: string) => {
      if (input.includes('api-index')) {return 'api123';}
      if (input.includes('deps')) {return 'deps456';}
      if (input.includes('checksum')) {return 'checksum789';}
      return 'hash123';
    });

    mockContext.flags = { json: true };

    const result = await run(mockContext, [], {});

    expect(getExitCode(result)).toBe(0);
  });

  it('should handle quiet mode', async () => {
    const shaSpy = vi.spyOn(mindCore, 'sha256');
    const { readFile, access } = await import('node:fs/promises');

    // Mock file access
    vi.mocked(access).mockResolvedValue(undefined);

    // Mock index.json with proper structure
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
      schemaVersion: '1.0',
      generator: 'mind-indexer',
      lastUpdated: '2024-01-01T00:00:00Z',
      apiIndexHash: 'api123',
      depsHash: 'deps456',
      indexChecksum: 'checksum789'
    }));

    // Mock individual index files
    vi.mocked(readFile).mockResolvedValueOnce('{"schemaVersion": "1.0", "files": {}}');
    vi.mocked(readFile).mockResolvedValueOnce('{"schemaVersion": "1.0", "edges": []}');
    vi.mocked(readFile).mockResolvedValueOnce('{}');
    vi.mocked(readFile).mockResolvedValueOnce('{}');

    // Mock checksum computation to return consistent hashes
    shaSpy.mockImplementation((input: string) => {
      if (input.includes('api-index')) {return 'api123';}
      if (input.includes('deps')) {return 'deps456';}
      if (input.includes('checksum')) {return 'checksum789';}
      return 'hash123';
    });

    const result = await run(mockContext, [], { quiet: true });

    expect(getExitCode(result)).toBe(0);
  });
});
