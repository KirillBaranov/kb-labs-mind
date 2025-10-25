import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { initMindStructure } from '../../../mind-indexer/src/api/init.js';
import { buildPack } from '../api/build.js';
import { DEFAULT_BUDGET } from '@kb-labs/mind-core';

describe('E2E Mind Pack', () => {
  const fixtureDir = join(process.cwd(), '../../fixtures/sample-project');
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

  it('should build context pack', async () => {
    const result = await buildPack({
      cwd: tempDir,
      intent: 'Test intent for E2E',
      product: 'sample-project',
      budget: DEFAULT_BUDGET,
      log: () => {}
    });

    expect(result.json.schemaVersion).toBe('1.0');
    expect(result.json.generator).toBe('kb-labs-mind@0.1.0');
    expect(result.json.intent).toBe('Test intent for E2E');
    expect(result.json.product).toBe('sample-project');
    expect(result.json.sections).toBeDefined();
    expect(result.json.tokensEstimate).toBeGreaterThan(0);
    expect(result.json.sectionUsage).toBeDefined();

    expect(result.markdown).toBeDefined();
    expect(result.markdown.length).toBeGreaterThan(0);
    expect(result.markdown).toContain('Test intent for E2E');

    expect(result.tokensEstimate).toBeGreaterThan(0);
  });
});
