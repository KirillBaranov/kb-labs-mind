import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { initMindStructure } from '../../../mind-indexer/src/api/init';
import { updateIndexes } from '../../../mind-indexer/src/api/update';
import { buildPack } from '../api/build.js';
import { DEFAULT_BUDGET } from '@kb-labs/mind-core';

describe('E2E Mind Pack', () => {
  const fixtureDir = '/Users/kirillbaranov/Desktop/kb-labs/kb-labs-mind/fixtures/sample-project';
  const tempDir = join(process.cwd(), '../../temp-test');

  beforeAll(async () => {
    // Copy fixture to temp directory
    await fsp.cp(fixtureDir, tempDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup temp directory
    try {
      await fsp.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should initialize Mind structure', async () => {
    await initMindStructure({ cwd: tempDir, log: () => {} });
    
    // Check that .kb/mind directory was created
    const mindDir = join(tempDir, '.kb', 'mind');
    const exists = await fsp.access(mindDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    // Check that index files exist
    const indexFile = join(mindDir, 'index.json');
    const indexContent = await fsp.readFile(indexFile, 'utf8');
    const index = JSON.parse(indexContent);
    
    expect(index.schemaVersion).toBe('1.0');
    expect(index.generator).toBe('kb-labs-mind@0.1.0');
    expect(index.filesIndexed).toBe(0);
  });

  it('should complete full workflow: init → update → pack', async () => {
    // 1. Initialize Mind structure
    await initMindStructure({ cwd: tempDir, log: () => {} });
    
    // 2. Update indexes with sample files
    const sampleFiles = ['src/index.ts', 'src/types.ts', 'src/utils.ts'];
    const report = await updateIndexes({
      cwd: tempDir,
      changed: sampleFiles,
      timeBudgetMs: 5000,
      log: () => {}
    });

    expect(report).toBeDefined();
    expect(report.api).toBeDefined();
    expect(report.durationMs).toBeGreaterThan(0);

    // 3. Build context pack
    const result = await buildPack({
      cwd: tempDir,
      intent: 'Implement comprehensive error handling system',
      product: 'sample-project',
      budget: DEFAULT_BUDGET,
      log: () => {}
    });

    // Verify pack structure
    expect(result.json.schemaVersion).toBe('1.0');
    expect(result.json.generator).toBe('kb-labs-mind@0.1.0');
    expect(result.json.intent).toBe('Implement comprehensive error handling system');
    expect(result.json.product).toBe('sample-project');
    expect(result.json.sections).toBeDefined();
    expect(result.json.tokensEstimate).toBeGreaterThan(0);
    expect(result.json.sectionUsage).toBeDefined();

    // Verify sections exist
    const expectedSections = [
      'intent_summary',
      'product_overview', 
      'api_signatures',
      'recent_diffs',
      'impl_snippets',
      'configs_profiles'
    ];
    
    for (const section of expectedSections) {
      expect(result.json.sections[section]).toBeDefined();
      expect(typeof result.json.sections[section]).toBe('string');
    }

    // Verify markdown content
    expect(result.markdown).toContain('# Intent: Implement comprehensive error handling system');
    expect(result.markdown).toContain('# Product Overview: sample-project');
    expect(result.markdown).toContain('# API Signatures');
    expect(result.markdown).toContain('# Implementation Snippets');

    // Verify budget was respected
    expect(result.tokensEstimate).toBeLessThanOrEqual(DEFAULT_BUDGET.totalTokens);
    expect(result.json.budgetApplied.totalTokens).toBe(DEFAULT_BUDGET.totalTokens);
  });

  it('should handle empty indexes gracefully', async () => {
    const emptyDir = join(tempDir, 'empty-test');
    await fsp.mkdir(emptyDir, { recursive: true });

    // Initialize empty structure
    await initMindStructure({
      cwd: emptyDir,
      log: () => {}
    });

    // Build pack with empty indexes
    const result = await buildPack({
      cwd: emptyDir,
      intent: 'Test empty project',
      budget: DEFAULT_BUDGET,
      log: () => {}
    });

    expect(result.json.sections.intent_summary).toContain('Test empty project');
    expect(result.json.sections.product_overview).toContain('Files indexed: 0');
    expect(result.tokensEstimate).toBeGreaterThan(0);
  });
});
