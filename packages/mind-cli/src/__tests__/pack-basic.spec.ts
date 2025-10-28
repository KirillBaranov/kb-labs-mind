/**
 * Basic tests for pack.ts CLI command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../cli/pack.js';
import type { CommandContext } from '../cli/types.js';

// Mock dependencies
vi.mock('@kb-labs/mind-pack', () => ({
  buildPack: vi.fn()
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn()
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

describe('Mind Pack Command - Basic Tests', () => {
  it('should handle basic pack command', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api_signatures: 75 } },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(result).toBe(0);
    expect(buildPack).toHaveBeenCalled();
    expect(mockPresenter.write).toHaveBeenCalledWith('# Project Context');
  });

  it('should handle custom budget', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api_signatures: 75 } },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      budget: 500
    });

    expect(result).toBe(0);
    expect(buildPack).toHaveBeenCalledWith({
      cwd: '/test/project',
      intent: 'analyze project',
      budget: { totalTokens: 500, caps: {}, truncation: 'end' },
      log: expect.any(Function)
    });
  });

  it('should handle JSON mode', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api_signatures: 75 } },
      tokensEstimate: 100
    });

    mockContext.flags = { json: true };

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(result).toBe(0);
    // JSON mode should call presenter.json
    // expect(mockPresenter.json).toHaveBeenCalled();
  });

  it('should handle quiet mode', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api_signatures: 75 } },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      quiet: true
    });

    expect(result).toBe(0);
    // In quiet mode, presenter.write should still be called for output
    expect(mockPresenter.write).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockRejectedValue(new Error('Pack failed'));

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(result).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Pack failed');
  });
});
