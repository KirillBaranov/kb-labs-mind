/**
 * Unit tests for mind:update command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../cli/update.js';
import type { CommandContext } from '../cli/types.js';

// Mock dependencies
vi.mock('@kb-labs/mind-indexer', () => ({
  updateIndexes: vi.fn()
}));

vi.mock('@kb-labs/shared-cli-ui', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    fail: vi.fn()
  })),
  TimingTracker: vi.fn(() => ({
    checkpoint: vi.fn(),
    total: vi.fn(() => 100)
  })),
  box: vi.fn((title, content) => `[${title}]\n${content.join('\n')}`),
  keyValue: vi.fn((pairs) => Object.entries(pairs).map(([k, v]) => `${k}: ${v}`)),
  safeColors: {
    success: (s: string) => `✓ ${s}`,
    warning: (s: string) => `⚠ ${s}`
  },
  formatTiming: vi.fn((ms) => `${ms}ms`)
}));

describe('Mind Update Command', () => {
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

  it('should update indexes successfully', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 5, updated: 2, removed: 1 },
      deps: { edgesAdded: 10, edgesRemoved: 3 },
      diff: { files: 3 },
      partial: false,
      budget: { usedMs: 1000, limitMs: 5000 }
    });

    const result = await run(mockContext, [], {});

    expect(result).toBe(0);
      expect(updateIndexes).toHaveBeenCalledWith({
        cwd: '/test/project',
        log: expect.any(Function),
        timeBudgetMs: 5000
      });
    expect(mockPresenter.write).toHaveBeenCalled();
  });

  it('should handle custom flags', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 0, updated: 0, removed: 0 },
      deps: { edgesAdded: 0, edgesRemoved: 0 },
      diff: { files: 0 },
      partial: false
    });

    const result = await run(mockContext, [], {
      cwd: '/custom/path',
      since: 'HEAD~1',
      'time-budget': 1000
    });

    expect(result).toBe(0);
    expect(updateIndexes).toHaveBeenCalledWith({
      cwd: '/custom/path',
      since: 'HEAD~1',
      timeBudgetMs: 1000,
      log: expect.any(Function)
    });
  });

  it('should handle JSON mode', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 2, updated: 1, removed: 0 },
      deps: { edgesAdded: 5, edgesRemoved: 1 },
      diff: { files: 2 },
      partial: false,
      budget: { usedMs: 500, limitMs: 5000 }
    });

    const result = await run(mockContext, [], { json: true });

    expect(result).toBe(0);
    expect(mockPresenter.json).toHaveBeenCalledWith({
      ok: true,
      delta: expect.any(Object),
      budget: expect.any(Object),
      timing: expect.any(Number)
    });
  });

  it('should handle partial updates', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 1, updated: 0, removed: 0 },
      deps: { edgesAdded: 2, edgesRemoved: 0 },
      diff: { files: 1 },
      partial: true,
      budget: { usedMs: 5000, limitMs: 5000 }
    });

    const result = await run(mockContext, [], {});

    expect(result).toBe(0);
    expect(mockPresenter.write).toHaveBeenCalledWith(
      expect.stringContaining('⚠ Partial')
    );
  });

  it('should handle quiet mode', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 0, updated: 0, removed: 0 },
      deps: { edgesAdded: 0, edgesRemoved: 0 },
      diff: { files: 0 },
      partial: false
    });

    const result = await run(mockContext, [], { quiet: true });

    expect(result).toBe(0);
    // Should not call presenter.write in quiet mode
    expect(mockPresenter.write).not.toHaveBeenCalled();
  });

  it('should handle update errors', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    vi.mocked(updateIndexes).mockRejectedValue(new Error('Git not found'));

    const result = await run(mockContext, [], {});

    expect(result).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Git not found');
  });

  it('should handle JSON mode errors', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    vi.mocked(updateIndexes).mockRejectedValue(new Error('Git not found'));

    const result = await run(mockContext, [], { json: true });

    expect(result).toBe(1);
    expect(mockPresenter.json).toHaveBeenCalledWith({
      ok: false,
      code: 'MIND_UPDATE_ERROR',
      message: 'Git not found',
      hint: 'Check your workspace and git status'
    });
  });
});
