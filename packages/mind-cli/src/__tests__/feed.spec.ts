/**
 * Unit tests for mind:feed command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../cli/commands/feed';
import type { CommandContext } from '../cli/types';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import { getExitCode, getProducedArtifacts } from './helpers';

// Mock dependencies
vi.mock('@kb-labs/mind-indexer', () => ({
  updateIndexes: vi.fn()
}));

vi.mock('@kb-labs/mind-pack', () => ({
  buildPack: vi.fn()
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));

describe('Mind Feed Command', () => {
  let mockContext: CommandContext;
  let mockPresenter: any;

  const PACK_ARTIFACT_ID =
    pluginContractsManifest.artifacts['mind.pack.output']?.id ?? 'mind.pack.output';
  const UPDATE_ARTIFACT_ID =
    pluginContractsManifest.artifacts['mind.update.report']?.id ?? 'mind.update.report';

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

  it('should run update and pack successfully', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 2, updated: 1, removed: 0 },
      deps: { edgesAdded: 5, edgesRemoved: 1 },
      diff: { files: 2 },
      partial: false,
      budget: { usedMs: 1000, limitMs: 5000 }
    });

    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api', 'deps'], sectionUsage: { api: 100, deps: 200 } },
      tokensEstimate: 300
    });

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(getExitCode(result)).toBe(0);
    expect(getProducedArtifacts(result)).toEqual(expect.arrayContaining([PACK_ARTIFACT_ID, UPDATE_ARTIFACT_ID]));
    expect(updateIndexes).toHaveBeenCalled();
    expect(buildPack).toHaveBeenCalled();
    expect(mockPresenter.write).toHaveBeenCalledWith('# Project Context');
  });

  it('should run pack-only mode', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api: 100 } },
      tokensEstimate: 150
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      'no-update': true
    });

    expect(getExitCode(result)).toBe(0);
    expect(getProducedArtifacts(result)).toEqual([PACK_ARTIFACT_ID]);
    expect(buildPack).toHaveBeenCalled();
    expect(mockPresenter.write).toHaveBeenCalledWith('# Project Context');
  });

  it('should handle custom budget', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 0, updated: 0, removed: 0 },
      deps: { edgesAdded: 0, edgesRemoved: 0 },
      diff: { files: 0 },
      partial: false
    });

    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api: 50 } },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      budget: 2000
    });

    expect(getExitCode(result)).toBe(0);
    expect(buildPack).toHaveBeenCalledWith({
      cwd: '/test/project',
      intent: 'analyze project',
      budget: { totalTokens: 2000, caps: {}, truncation: 'end' },
      log: expect.any(Function)
    });
  });

  it('should handle product and preset', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 0, updated: 0, removed: 0 },
      deps: { edgesAdded: 0, edgesRemoved: 0 },
      diff: { files: 0 },
      partial: false
    });

    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api: 50 } },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      product: 'react-app',
      preset: 'frontend'
    });
 
    expect(getExitCode(result)).toBe(0);
    expect(buildPack).toHaveBeenCalledWith({
      cwd: '/test/project',
      intent: 'analyze project',
      budget: { totalTokens: 9000, caps: {}, truncation: 'end' },
      product: 'react-app',
      preset: 'frontend',
      log: expect.any(Function)
    });
  });

  it('should handle with-bundle flag', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 0, updated: 0, removed: 0 },
      deps: { edgesAdded: 0, edgesRemoved: 0 },
      diff: { files: 0 },
      partial: false
    });

    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api', 'bundle'], sectionUsage: { api: 50, bundle: 100 } },
      tokensEstimate: 200
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      'with-bundle': true
    });
 
    expect(getExitCode(result)).toBe(0);
    expect(buildPack).toHaveBeenCalledWith({
      cwd: '/test/project',
      intent: 'analyze project',
      budget: { totalTokens: 9000, caps: {}, truncation: 'end' },
      withBundle: true,
      log: expect.any(Function)
    });
  });

  it('should handle JSON mode', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 1, updated: 0, removed: 0 },
      deps: { edgesAdded: 2, edgesRemoved: 0 },
      diff: { files: 1 },
      partial: false,
      budget: { usedMs: 500, limitMs: 5000 }
    });

    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { 
        sections: ['api_signatures', 'impl_snippets'], 
        sectionUsage: { 
          api_signatures: 75,
          impl_snippets: 150,
          intent_summary: 50,
          product_overview: 100,
          recent_diffs: 25,
          configs_profiles: 100
        } 
      },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { intent: 'analyze project', json: true });
 
    expect(getExitCode(result)).toBe(0);
    expect(mockPresenter.json).toHaveBeenCalledWith(expect.objectContaining({
       ok: true,
       mode: 'update-and-pack',
       intent: 'analyze project',
       product: undefined,
       tokensEstimate: 100,
       out: null,
       produces: expect.arrayContaining([PACK_ARTIFACT_ID, UPDATE_ARTIFACT_ID]),
       update: {
         delta: undefined,
         budget: {
          limitMs: 5000,
          usedMs: 500,
        }
      },
      pack: {
        sectionUsage: { 
          api_signatures: 75,
          impl_snippets: 150,
          intent_summary: 50,
          product_overview: 100,
          recent_diffs: 25,
          configs_profiles: 100
        },
        deterministic: false
      },
      ignoredFlags: undefined
    }));
  });

  it('should handle output to file', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    const { buildPack } = await import('@kb-labs/mind-pack');
    const { writeFile, mkdir } = await import('node:fs/promises');
    
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 0, updated: 0, removed: 0 },
      deps: { edgesAdded: 0, edgesRemoved: 0 },
      diff: { files: 0 },
      partial: false
    });

    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api: 50 } },
      tokensEstimate: 100
    });

    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      out: 'context.md'
     });
 
    expect(getExitCode(result)).toBe(0);
    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
  });

  it('should handle quiet mode', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 0, updated: 0, removed: 0 },
      deps: { edgesAdded: 0, edgesRemoved: 0 },
      diff: { files: 0 },
      partial: false
    });

    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api: 50 } },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { intent: 'analyze project', quiet: true });

    expect(getExitCode(result)).toBe(0);
    // In quiet mode, console.log is still called but presenter.write is not
    expect(mockPresenter.write).toHaveBeenCalledWith('# Project Context');
  });

  it('should handle missing intent', async () => {
    const result = await run(mockContext, [], { intent: undefined });

    expect(getExitCode(result)).toBe(0); // Command uses default intent 'ad-hoc feed'
    expect(mockPresenter.write).toHaveBeenCalled();
  });

  it('should handle JSON mode missing intent', async () => {
    const result = await run(mockContext, [], { intent: undefined, json: true });

    expect(getExitCode(result)).toBe(0); // Command uses default intent 'ad-hoc feed'
    expect(mockPresenter.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true
    }));
  });

  it('should handle invalid budget', async () => {
    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      budget: 0
    });

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Budget must be greater than 0');
  });

  it('should handle update errors', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    vi.mocked(updateIndexes).mockRejectedValue(new Error('Git not found'));

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Git not found');
  });

  it('should handle pack errors', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    const { buildPack } = await import('@kb-labs/mind-pack');
    
    vi.mocked(updateIndexes).mockResolvedValue({
      api: { added: 0, updated: 0, removed: 0 },
      deps: { edgesAdded: 0, edgesRemoved: 0 },
      diff: { files: 0 },
      partial: false
    });

    vi.mocked(buildPack).mockRejectedValue(new Error('No indexes found'));

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('No indexes found');
  });

  it('should handle JSON mode errors', async () => {
    const { updateIndexes } = await import('@kb-labs/mind-indexer');
    vi.mocked(updateIndexes).mockRejectedValue(new Error('Git not found'));

    const result = await run(mockContext, [], { intent: 'analyze project', json: true });

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      code: 'MIND_FEED_ERROR',
      message: 'Git not found',
      hint: 'Mind feed operation failed - check logs for details'
    }));
  });
});
