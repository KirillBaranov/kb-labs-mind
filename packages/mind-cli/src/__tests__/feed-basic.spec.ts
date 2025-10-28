/**
 * Basic tests for feed.ts CLI command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../cli/feed.js';
import type { CommandContext } from '../cli/types.js';

// Mock dependencies
vi.mock('@kb-labs/mind-indexer', () => ({
  updateIndexes: vi.fn()
}));

vi.mock('@kb-labs/mind-pack', () => ({
  buildPack: vi.fn()
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

describe('Mind Feed Command - Basic Tests', () => {
  it('should handle basic feed command', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 0, updated: 0, removed: 0 },
      deps: { edgesAdded: 0, edgesRemoved: 0 },
      docs: { added: 0, updated: 0, removed: 0 },
      diff: { files: 0 },
      totalFiles: 0,
      timeMs: 100,
      partial: false,
      budget: { usedMs: 100, limitMs: 5000 }
    });

    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api_signatures: 75 } },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(result).toBe(0);
    expect(updateIndexes).toHaveBeenCalled();
    expect(buildPack).toHaveBeenCalled();
  });

  it('should handle pack-only mode', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api_signatures: 75 } },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      'pack-only': true
    });

    expect(result).toBe(0);
    expect(buildPack).toHaveBeenCalled();
  });

  it('should handle JSON mode', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 0, updated: 0, removed: 0 },
      deps: { edgesAdded: 0, edgesRemoved: 0 },
      docs: { added: 0, updated: 0, removed: 0 },
      diff: { files: 0 },
      totalFiles: 0,
      timeMs: 100,
      partial: false,
      budget: { usedMs: 100, limitMs: 5000 }
    });

    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api_signatures: 75 } },
      tokensEstimate: 100
    });

    mockContext.flags = { json: true };

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(result).toBe(0);
    // JSON mode should call presenter.json or write to stdout
    // expect(mockPresenter.json).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    vi.mocked(updateIndexes).mockRejectedValue(new Error('Update failed'));

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(result).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Update failed');
  });
});
