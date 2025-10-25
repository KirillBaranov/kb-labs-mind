import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { initMindStructure } from '../api/init.js';
import { updateIndexes } from '../api/update.js';

describe('E2E Mind Indexer', () => {
  const fixtureDir = '/Users/kirillbaranov/Desktop/kb-labs/kb-labs-mind/fixtures/sample-project';
  const tempDir = join(process.cwd(), '../../temp-indexer-test');

  beforeAll(async () => {
    await fsp.mkdir(tempDir, { recursive: true });
    // Copy fixture to temp directory
    await fsp.cp(fixtureDir, tempDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fsp.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should complete full indexing workflow', async () => {
    // 1. Initialize Mind structure
    const mindDir = await initMindStructure({
      cwd: tempDir,
      log: () => {}
    });
    
    expect(mindDir).toBe(join(tempDir, '.kb/mind'));
    
    // Verify structure created
    const files = await fsp.readdir(mindDir);
    expect(files).toContain('index.json');
    expect(files).toContain('api-index.json');
    expect(files).toContain('deps.json');
    expect(files).toContain('recent-diff.json');

    // 2. Update indexes with sample files
    const sampleFiles = ['src/index.ts', 'src/types.ts', 'src/utils.ts'];
    const report = await updateIndexes({
      cwd: tempDir,
      changed: sampleFiles,
      timeBudgetMs: 5000,
      log: () => {}
    });

    // Verify report structure
    expect(report).toBeDefined();
    expect(report.api).toBeDefined();
    expect(report.api.added).toBeGreaterThanOrEqual(0);
    expect(report.api.updated).toBeGreaterThanOrEqual(0);
    expect(report.api.removed).toBeGreaterThanOrEqual(0);
    expect(report.durationMs).toBeGreaterThan(0);
    expect(report.budget).toBeDefined();
    expect(report.budget.limitMs).toBe(5000);
    expect(report.budget.usedMs).toBeGreaterThan(0);

    // 3. Verify API index was created
    const apiIndexPath = join(mindDir, 'api-index.json');
    const apiIndexContent = await fsp.readFile(apiIndexPath, 'utf8');
    const apiIndex = JSON.parse(apiIndexContent);
    
    expect(apiIndex.schemaVersion).toBe('1.0');
    expect(apiIndex.generator).toBe('kb-labs-mind@0.1.0');
    expect(apiIndex.files).toBeDefined();
    
    // Should have indexed files
    expect(Object.keys(apiIndex.files).length).toBeGreaterThan(0);
    
    // Verify file entries have required fields
    for (const [filePath, fileData] of Object.entries(apiIndex.files)) {
      expect(fileData).toHaveProperty('exports');
      expect(fileData).toHaveProperty('size');
      expect(fileData).toHaveProperty('sha256');
      expect(Array.isArray(fileData.exports)).toBe(true);
    }

    // 4. Verify index.json was updated
    const indexPath = join(mindDir, 'index.json');
    const indexContent = await fsp.readFile(indexPath, 'utf8');
    const index = JSON.parse(indexContent);
    
    expect(index.schemaVersion).toBe('1.0');
    expect(index.generator).toBe('kb-labs-mind@0.1.0');
    expect(index.root).toBeDefined();
    expect(index.filesIndexed).toBeGreaterThanOrEqual(0);
    expect(index.apiIndexHash).toBeDefined();
    expect(index.depsHash).toBeDefined();
    expect(index.recentDiffHash).toBeDefined();
  });

  it('should handle time budget exceeded gracefully', async () => {
    const budgetDir = join(tempDir, 'budget-test');
    await fsp.mkdir(budgetDir, { recursive: true });
    await fsp.cp(fixtureDir, budgetDir, { recursive: true });

    // Initialize
    await initMindStructure({
      cwd: budgetDir,
      log: () => {}
    });

    // Update with very tight budget
    const report = await updateIndexes({
      cwd: budgetDir,
      changed: ['src/index.ts', 'src/types.ts', 'src/utils.ts'],
      timeBudgetMs: 1, // Very tight budget
      log: () => {}
    });

    expect(report).toBeDefined();
    expect(report.partial).toBe(true);
    expect(report.budget.usedMs).toBeGreaterThanOrEqual(1);
  });

  it('should handle missing files gracefully', async () => {
    const missingDir = join(tempDir, 'missing-test');
    await fsp.mkdir(missingDir, { recursive: true });

    // Initialize
    await initMindStructure({
      cwd: missingDir,
      log: () => {}
    });

    // Update with non-existent files
    const report = await updateIndexes({
      cwd: missingDir,
      changed: ['non-existent.ts', 'also-missing.js'],
      timeBudgetMs: 1000,
      log: () => {}
    });

    expect(report).toBeDefined();
    expect(report.api.removed).toBeGreaterThanOrEqual(0);
    expect(report.api.added).toBe(0);
    expect(report.api.updated).toBe(0);
  });
});
