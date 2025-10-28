/**
 * Additional tests for mind-indexer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { initMindStructure, updateIndexes } from '../index.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = join(__dirname, '../../../../fixtures/small-project');

describe('Mind Indexer', () => {
  beforeEach(async () => {
    // Clean up any existing mind structure
    try {
      await fsp.rm(join(fixturePath, '.kb'), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fsp.rm(join(fixturePath, '.kb'), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should initialize mind structure', async () => {
    const mindDir = await initMindStructure({ cwd: fixturePath });
    expect(mindDir).toBeDefined();
    
    // Check that mind directory was created
    const mindPath = join(fixturePath, '.kb', 'mind');
    const exists = await fsp.access(mindPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('should update indexes', async () => {
    // Initialize first
    await initMindStructure({ cwd: fixturePath });
    
    // Update indexes
    const result = await updateIndexes({
      cwd: fixturePath,
      timeBudgetMs: 5000
    });
    
    expect(result).toBeDefined();
    expect(result.api).toBeDefined();
    expect(result.budget).toBeDefined();
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('should respect time budget', async () => {
    await initMindStructure({ cwd: fixturePath });
    
    const result = await updateIndexes({
      cwd: fixturePath,
      timeBudgetMs: 1 // Very small budget
    });
    
    expect(result.budget.limitMs).toBe(1);
    expect(result.budget.usedMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty workspace', async () => {
    const emptyPath = join(__dirname, '../../../../fixtures/empty-test');
    
    try {
      await fsp.mkdir(emptyPath, { recursive: true });
      
      const mindDir = await initMindStructure({ cwd: emptyPath });
      expect(mindDir).toBeDefined();
      
      // Should create empty structure
      const exists = await fsp.access(mindDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    } finally {
      // Cleanup
      try {
        await fsp.rm(emptyPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});
