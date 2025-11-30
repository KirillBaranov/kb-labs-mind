/**
 * Snapshot tests for Mind Query API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestHelper } from '../helpers/index';
import { createFixture } from '../fixtures/index';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';

describe('Mind Query Snapshots', () => {
  let testProject: any;
  const testDir = join(process.cwd(), 'test-fixtures');

  beforeAll(async () => {
    // Create test project
    await createFixture('small', testDir);
    testProject = { path: testDir, name: 'small' };
    
    // Initialize mind workspace
    await TestHelper.runMindCommand(testDir, 'init');
    await TestHelper.runMindCommand(testDir, 'update');
  });

  afterAll(async () => {
    // Cleanup
    try {
      await fsp.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Basic Query Snapshots', () => {
    it('should produce consistent meta query results', async () => {
      const result = await TestHelper.runMindCommand(testDir, 'query', ['meta', '--json']);
      
      expect(result.exitCode).toBe(0);
      
      const data = JSON.parse(result.stdout);
      expect(data).toMatchSnapshot('meta-query-basic');
      
      // Verify schema version
      expect(data.schemaVersion).toBe('1.0');
      expect(data.ok).toBe(true);
    });

    it('should produce consistent exports query results', async () => {
      const result = await TestHelper.runMindCommand(testDir, 'query', ['exports', '--file', 'src/index.ts', '--json']);
      
      expect(result.exitCode).toBe(0);
      
      const data = JSON.parse(result.stdout);
      expect(data).toMatchSnapshot('exports-query-basic');
      
      // Verify schema version
      expect(data.schemaVersion).toBe('1.0');
      expect(data.ok).toBe(true);
    });

    it('should produce consistent docs query results', async () => {
      const result = await TestHelper.runMindCommand(testDir, 'query', ['docs', '--json']);
      
      expect(result.exitCode).toBe(0);
      
      const data = JSON.parse(result.stdout);
      expect(data).toMatchSnapshot('docs-query-basic');
      
      // Verify schema version
      expect(data.schemaVersion).toBe('1.0');
      expect(data.ok).toBe(true);
    });
  });

  describe('AI Mode Snapshots', () => {
    it('should produce consistent AI mode summaries', async () => {
      const result = await TestHelper.runMindCommand(testDir, 'query', ['meta', '--ai-mode', '--json']);
      
      expect(result.exitCode).toBe(0);
      
      const data = JSON.parse(result.stdout);
      expect(data).toMatchSnapshot('meta-query-ai-mode');
      
      // Verify AI mode features
      expect(data.summary).toBeDefined();
      expect(data.suggestNextQueries).toBeDefined();
      expect(Array.isArray(data.suggestNextQueries)).toBe(true);
    });

    it('should produce consistent AI mode exports summaries', async () => {
      const result = await TestHelper.runMindCommand(testDir, 'query', ['exports', '--file', 'src/index.ts', '--ai-mode', '--json']);
      
      expect(result.exitCode).toBe(0);
      
      const data = JSON.parse(result.stdout);
      expect(data).toMatchSnapshot('exports-query-ai-mode');
      
      // Verify AI mode features
      expect(data.summary).toBeDefined();
      expect(data.suggestNextQueries).toBeDefined();
    });

    it('should produce consistent AI mode docs summaries', async () => {
      const result = await TestHelper.runMindCommand(testDir, 'query', ['docs', '--ai-mode', '--json']);
      
      expect(result.exitCode).toBe(0);
      
      const data = JSON.parse(result.stdout);
      expect(data).toMatchSnapshot('docs-query-ai-mode');
      
      // Verify AI mode features
      expect(data.summary).toBeDefined();
      expect(data.suggestNextQueries).toBeDefined();
    });
  });

  describe('Error Handling Snapshots', () => {
    it('should produce consistent error responses for invalid queries', async () => {
      const result = await TestHelper.runMindCommand(testDir, 'query', ['invalid-query', '--json']);
      
      expect(result.exitCode).toBe(1);
      
      const data = JSON.parse(result.stdout);
      expect(data).toMatchSnapshot('invalid-query-error');
      
      // Verify error structure
      expect(data.ok).toBe(false);
      expect(data.code).toBeDefined();
      expect(data.schemaVersion).toBe('1.0');
    });

    it('should produce consistent error responses for missing files', async () => {
      const result = await TestHelper.runMindCommand(testDir, 'query', ['exports', '--file', 'nonexistent.ts', '--json']);
      
      expect(result.exitCode).toBe(1);
      
      const data = JSON.parse(result.stdout);
      expect(data).toMatchSnapshot('missing-file-error');
      
      // Verify error structure
      expect(data.ok).toBe(false);
      expect(data.code).toBeDefined();
      expect(data.schemaVersion).toBe('1.0');
    });
  });

  describe('Performance Snapshots', () => {
    it('should meet performance targets for cached queries', async () => {
      // First query (uncached)
      const firstResult = await TestHelper.runMindCommand(testDir, 'query', ['meta', '--json']);
      expect(firstResult.exitCode).toBe(0);
      
      const firstData = JSON.parse(firstResult.stdout);
      expect(firstData.meta.cached).toBe(false);
      
      // Second query (cached)
      const secondResult = await TestHelper.runMindCommand(testDir, 'query', ['meta', '--json']);
      expect(secondResult.exitCode).toBe(0);
      
      const secondData = JSON.parse(secondResult.stdout);
      expect(secondData.meta.cached).toBe(true);
      
      // Verify performance targets
      expect(secondData.meta.timingMs.total).toBeLessThan(20); // Cached < 20ms
      expect(firstData.meta.timingMs.total).toBeLessThan(60); // Uncached < 60ms
    });
  });
});
