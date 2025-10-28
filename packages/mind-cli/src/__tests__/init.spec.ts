/**
 * Unit tests for mind:init command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../cli/init.js';
import type { CommandContext } from '../cli/types.js';

// Mock dependencies
vi.mock('@kb-labs/mind-indexer', () => ({
  initMindStructure: vi.fn()
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn()
}));

describe('Mind Init Command', () => {
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

  it('should initialize mind workspace successfully', async () => {
    const { initMindStructure } = await import('@kb-labs/mind-indexer');
    vi.mocked(initMindStructure).mockResolvedValue('/test/project/.kb/mind');

    const result = await run(mockContext, [], { force: false });

    expect(result).toBe(0);
    expect(initMindStructure).toHaveBeenCalledWith({
      cwd: '/test/project',
      force: false,
      log: expect.any(Function)
    });
    // Command uses console.log instead of presenter.write
    expect(mockPresenter.write).not.toHaveBeenCalled();
  });

  it('should handle force flag', async () => {
    const { initMindStructure } = await import('@kb-labs/mind-indexer');
    vi.mocked(initMindStructure).mockResolvedValue('/test/project/.kb/mind');

    const result = await run(mockContext, [], { force: true });

    expect(result).toBe(0);
    expect(initMindStructure).toHaveBeenCalledWith({
      cwd: '/test/project',
      force: true,
      log: expect.any(Function)
    });
  });

  it('should handle custom cwd', async () => {
    const { initMindStructure } = await import('@kb-labs/mind-indexer');
    vi.mocked(initMindStructure).mockResolvedValue('/custom/path/.kb/mind');

    mockContext.flags = { cwd: '/custom/path' };

    const result = await run(mockContext, [], {});

    expect(result).toBe(0);
    expect(initMindStructure).toHaveBeenCalledWith({
      cwd: '/test/project',
      force: false,
      log: expect.any(Function)
    });
  });

  it('should handle JSON mode', async () => {
    const { initMindStructure } = await import('@kb-labs/mind-indexer');
    vi.mocked(initMindStructure).mockResolvedValue('/test/project/.kb/mind');

    const result = await run(mockContext, [], { json: true });

    expect(result).toBe(0);
    expect(mockPresenter.json).toHaveBeenCalledWith({
      ok: true,
      mindDir: '/test/project/.kb/mind',
      cwd: '/test/project'
    });
  });

  it('should handle initialization errors', async () => {
    const { initMindStructure } = await import('@kb-labs/mind-indexer');
    vi.mocked(initMindStructure).mockRejectedValue(new Error('Permission denied'));

    const result = await run(mockContext, [], {});

    expect(result).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Permission denied');
  });

  it('should handle JSON mode errors', async () => {
    const { initMindStructure } = await import('@kb-labs/mind-indexer');
    vi.mocked(initMindStructure).mockRejectedValue(new Error('Permission denied'));

    const result = await run(mockContext, [], { json: true });

    expect(result).toBe(1);
    expect(mockPresenter.json).toHaveBeenCalledWith({
      ok: false,
      code: 'MIND_INIT_ERROR',
      message: 'Permission denied',
      hint: 'Check your workspace permissions and try again'
    });
  });
});
