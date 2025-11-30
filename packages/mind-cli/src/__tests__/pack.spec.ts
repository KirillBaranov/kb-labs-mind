/**
 * Unit tests for mind:pack command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../cli/commands/pack';
import type { CommandContext } from '../cli/types';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import { getExitCode, getProducedArtifacts } from './helpers';

// Mock dependencies
vi.mock('@kb-labs/mind-pack', () => ({
  buildPack: vi.fn()
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));

describe('Mind Pack Command', () => {
  let mockContext: CommandContext;
  let mockPresenter: any;
  const PACK_ARTIFACT_ID =
    pluginContractsManifest.artifacts['mind.pack.output']?.id ?? 'mind.pack.output';

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

  it('should build pack successfully', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context\n\nThis is the project context.',
      json: {
        schemaVersion: '1.0',
        generator: 'kb-labs-mind@0.1.0',
        intent: 'analyze project',
        budgetApplied: { totalTokens: 9000, caps: {}, truncation: 'end' },
        sections: {
          intent_summary: 'Project analysis',
          product_overview: 'React application',
          api_signatures: 'Component APIs',
          recent_diffs: 'Recent changes',
          impl_snippets: 'Code examples',
          configs_profiles: 'Configuration files'
        },
        tokensEstimate: 300,
        sectionUsage: { 
          intent_summary: 100, 
          product_overview: 200,
          api_signatures: 150,
          recent_diffs: 50,
          impl_snippets: 300,
          configs_profiles: 200
        },
        deterministic: false
      },
      tokensEstimate: 300
    });

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(getExitCode(result)).toBe(0);
    expect(getProducedArtifacts(result)).toContain(PACK_ARTIFACT_ID);
    expect(buildPack).toHaveBeenCalledWith({
      cwd: '/test/project',
      intent: 'analyze project',
      budget: { totalTokens: 9000, caps: {}, truncation: 'end' },
      log: expect.any(Function)
    });
    expect(mockPresenter.write).toHaveBeenCalledWith(
      '# Project Context\n\nThis is the project context.'
    );
  });

  it('should handle custom budget', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: {
        schemaVersion: '1.0',
        generator: 'kb-labs-mind@0.1.0',
        intent: 'analyze project',
        budgetApplied: { totalTokens: 2000, caps: {}, truncation: 'end' },
        sections: {
          intent_summary: 'Project analysis',
          product_overview: 'React application',
          api_signatures: 'Component APIs',
          recent_diffs: 'Recent changes',
          impl_snippets: 'Code examples',
          configs_profiles: 'Configuration files'
        },
        tokensEstimate: 100,
        sectionUsage: { 
          intent_summary: 50, 
          product_overview: 100,
          api_signatures: 75,
          recent_diffs: 25,
          impl_snippets: 150,
          configs_profiles: 100
        },
        deterministic: false
      },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      budget: 2000
    });

    expect(getExitCode(result)).toBe(0);
    expect(getProducedArtifacts(result)).toContain(PACK_ARTIFACT_ID);
    expect(buildPack).toHaveBeenCalledWith({
      cwd: '/test/project',
      intent: 'analyze project',
      budget: { totalTokens: 2000, caps: {}, truncation: 'end' },
      log: expect.any(Function)
    });
  });

  it('should handle product and preset', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: {
        schemaVersion: '1.0',
        generator: 'kb-labs-mind@0.1.0',
        intent: 'analyze project',
        budgetApplied: { totalTokens: 2000, caps: {}, truncation: 'end' },
        sections: {
          intent_summary: 'Project analysis',
          product_overview: 'React application',
          api_signatures: 'Component APIs',
          recent_diffs: 'Recent changes',
          impl_snippets: 'Code examples',
          configs_profiles: 'Configuration files'
        },
        tokensEstimate: 100,
        sectionUsage: { 
          intent_summary: 50, 
          product_overview: 100,
          api_signatures: 75,
          recent_diffs: 25,
          impl_snippets: 150,
          configs_profiles: 100
        },
        deterministic: false
      },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      product: 'react-app',
      preset: 'frontend'
    });

    expect(getExitCode(result)).toBe(0);
    expect(getProducedArtifacts(result)).toContain(PACK_ARTIFACT_ID);
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
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: {
        schemaVersion: '1.0',
        generator: 'kb-labs-mind@0.1.0',
        intent: 'analyze project',
        budgetApplied: { totalTokens: 2000, caps: {}, truncation: 'end' },
        sections: {
          intent_summary: 'Project analysis',
          product_overview: 'React application',
          api_signatures: 'Component APIs',
          recent_diffs: 'Recent changes',
          impl_snippets: 'Code examples',
          configs_profiles: 'Configuration files'
        },
        tokensEstimate: 100,
        sectionUsage: { 
          intent_summary: 50, 
          product_overview: 100,
          api_signatures: 75,
          recent_diffs: 25,
          impl_snippets: 150,
          configs_profiles: 100
        },
        deterministic: false
      },
      tokensEstimate: 200
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      'with-bundle': true
    });

    expect(getExitCode(result)).toBe(0);
    expect(getProducedArtifacts(result)).toContain(PACK_ARTIFACT_ID);
    expect(buildPack).toHaveBeenCalledWith({
      cwd: '/test/project',
      intent: 'analyze project',
      budget: { totalTokens: 9000, caps: {}, truncation: 'end' },
      withBundle: true,
      log: expect.any(Function)
    });
  });

  it('should handle seed for deterministic output', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: {
        schemaVersion: '1.0',
        generator: 'kb-labs-mind@0.1.0',
        intent: 'analyze project',
        budgetApplied: { totalTokens: 2000, caps: {}, truncation: 'end' },
        sections: {
          intent_summary: 'Project analysis',
          product_overview: 'React application',
          api_signatures: 'Component APIs',
          recent_diffs: 'Recent changes',
          impl_snippets: 'Code examples',
          configs_profiles: 'Configuration files'
        },
        tokensEstimate: 100,
        sectionUsage: { 
          intent_summary: 50, 
          product_overview: 100,
          api_signatures: 75,
          recent_diffs: 25,
          impl_snippets: 150,
          configs_profiles: 100
        },
        deterministic: false
      },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      seed: 12345
    });

    expect(getExitCode(result)).toBe(0);
    expect(getProducedArtifacts(result)).toContain(PACK_ARTIFACT_ID);
    expect(buildPack).toHaveBeenCalledWith({
      cwd: '/test/project',
      intent: 'analyze project',
      budget: { totalTokens: 9000, caps: {}, truncation: 'end' },
      seed: 12345,
      log: expect.any(Function)
    });
  });

  it('should handle JSON mode', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: {
        schemaVersion: '1.0',
        generator: 'kb-labs-mind@0.1.0',
        intent: 'analyze project',
        budgetApplied: { totalTokens: 2000, caps: {}, truncation: 'end' },
        sections: {
          intent_summary: 'Project analysis',
          product_overview: 'React application',
          api_signatures: 'Component APIs',
          recent_diffs: 'Recent changes',
          impl_snippets: 'Code examples',
          configs_profiles: 'Configuration files'
        },
        tokensEstimate: 100,
        sectionUsage: { 
          intent_summary: 50, 
          product_overview: 100,
          api_signatures: 75,
          recent_diffs: 25,
          impl_snippets: 150,
          configs_profiles: 100
        },
        deterministic: false
      },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { intent: 'analyze project', json: true });
 
     expect(getExitCode(result)).toBe(0);
    expect(mockPresenter.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        intent: 'analyze project',
        product: undefined,
        tokensEstimate: 100,
        produces: expect.arrayContaining([PACK_ARTIFACT_ID]),
        [PACK_ARTIFACT_ID]: expect.any(String),
        deterministic: false,
      })
    );
  });

  it('should handle output to file', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    const { writeFile, mkdir } = await import('node:fs/promises');
    
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: {
        schemaVersion: '1.0',
        generator: 'kb-labs-mind@0.1.0',
        intent: 'analyze project',
        budgetApplied: { totalTokens: 2000, caps: {}, truncation: 'end' },
        sections: {
          intent_summary: 'Project analysis',
          product_overview: 'React application',
          api_signatures: 'Component APIs',
          recent_diffs: 'Recent changes',
          impl_snippets: 'Code examples',
          configs_profiles: 'Configuration files'
        },
        tokensEstimate: 100,
        sectionUsage: { 
          intent_summary: 50, 
          product_overview: 100,
          api_signatures: 75,
          recent_diffs: 25,
          impl_snippets: 150,
          configs_profiles: 100
        },
        deterministic: false
      },
      tokensEstimate: 100
    });

    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      out: 'context.md'
     });
 
    expect(getExitCode(result)).toBe(0);
    expect(writeFile).toHaveBeenCalledWith('/test/project/context.md', '# Project Context', 'utf8');
  });

  it('should handle quiet mode', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: {
        schemaVersion: '1.0',
        generator: 'kb-labs-mind@0.1.0',
        intent: 'analyze project',
        budgetApplied: { totalTokens: 2000, caps: {}, truncation: 'end' },
        sections: {
          intent_summary: 'Project analysis',
          product_overview: 'React application',
          api_signatures: 'Component APIs',
          recent_diffs: 'Recent changes',
          impl_snippets: 'Code examples',
          configs_profiles: 'Configuration files'
        },
        tokensEstimate: 100,
        sectionUsage: { 
          intent_summary: 50, 
          product_overview: 100,
          api_signatures: 75,
          recent_diffs: 25,
          impl_snippets: 150,
          configs_profiles: 100
        },
        deterministic: false
      },
      tokensEstimate: 100
    });

    const result = await run(mockContext, [], { intent: 'analyze project', quiet: true });

    expect(getExitCode(result)).toBe(0);
    // In quiet mode, console.log is still called but presenter.write is not
    expect(mockPresenter.write).toHaveBeenCalledWith('# Project Context');
  });

  it('should handle missing intent', async () => {
    const result = await run(mockContext, [], {});

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Intent is required');
  });

  it('should handle JSON mode missing intent', async () => {
    const result = await run(mockContext, [], { json: true });
 
    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.json).toHaveBeenCalled();
    expect(mockPresenter.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: 'MIND_BAD_FLAGS',
        message: 'Intent is required',
        hint: 'Use --intent flag to specify the context intent',
      })
    );
  });

  it('should handle build pack errors', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockRejectedValue(new Error('No indexes found'));

    const result = await run(mockContext, [], { intent: 'analyze project' });

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('No indexes found');
  });

  it('should handle JSON mode errors', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockRejectedValue(new Error('No indexes found'));

    const result = await run(mockContext, [], { intent: 'analyze project', json: true });

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: 'MIND_PACK_ERROR',
        message: 'No indexes found',
        hint: 'Check your workspace and indexes',
      })
    );
  });

  it('should handle file write errors', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    const { writeFile, mkdir } = await import('node:fs/promises');
    
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: {
        schemaVersion: '1.0',
        generator: 'kb-labs-mind@0.1.0',
        intent: 'analyze project',
        budgetApplied: { totalTokens: 2000, caps: {}, truncation: 'end' },
        sections: {
          intent_summary: 'Project analysis',
          product_overview: 'React application',
          api_signatures: 'Component APIs',
          recent_diffs: 'Recent changes',
          impl_snippets: 'Code examples',
          configs_profiles: 'Configuration files'
        },
        tokensEstimate: 100,
        sectionUsage: { 
          intent_summary: 50, 
          product_overview: 100,
          api_signatures: 75,
          recent_diffs: 25,
          impl_snippets: 150,
          configs_profiles: 100
        },
        deterministic: false
      },
      tokensEstimate: 100
    });

    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockRejectedValue(new Error('ENOENT: no such file or directory, open \'/test/project/context.md\''));

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      out: 'context.md'
    });

    expect(getExitCode(result)).toBe(1);
  });

  it('should handle file write errors with custom error code', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api_signatures: 75 } },
      tokensEstimate: 100
    });

    // Mock writeFile to throw error with custom code
    const { writeFile } = await import('node:fs/promises');
    const customError = new Error('Custom error');
    (customError as any).code = 'CUSTOM_ERROR';
    vi.mocked(writeFile).mockRejectedValue(customError);

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      out: 'context.md'
    });

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('Custom error');
  });

  it('should handle file write errors with non-Error object', async () => {
    const { buildPack } = await import('@kb-labs/mind-pack');
    vi.mocked(buildPack).mockResolvedValue({
      markdown: '# Project Context',
      json: { sections: ['api'], sectionUsage: { api_signatures: 75 } },
      tokensEstimate: 100
    });

    // Mock writeFile to throw non-Error object
    const { writeFile } = await import('node:fs/promises');
    vi.mocked(writeFile).mockRejectedValue('String error');

    const result = await run(mockContext, [], { 
      intent: 'analyze project',
      out: 'context.md'
    });

    expect(getExitCode(result)).toBe(1);
    expect(mockPresenter.error).toHaveBeenCalledWith('String error');
  });
});
