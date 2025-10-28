/**
 * Stress tests for Mind Query API
 * Validates cache behavior and memory stability under load
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestHelper } from '../helpers/index.js';
import { createFixture } from '../fixtures/index.js';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';

describe('Mind Query Stress Tests', () => {
  let testProject: any;
  const testDir = join(process.cwd(), 'test-stress');

  beforeAll(async () => {
    // Create test project
    await createFixture('medium', testDir);
    testProject = { path: testDir, name: 'medium' };
    
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

  describe('Sequential Query Stress', () => {
    it('should handle 1000 sequential queries without memory leaks', async () => {
      const queries = [
        ['meta', '--json'],
        ['docs', '--json'],
        ['exports', '--file', 'packages/core/src/index.ts', '--json'],
        ['externals', '--json'],
        ['scope', '--path', 'packages/core', '--json']
      ];
      
      const iterations = 200; // 200 * 5 = 1000 queries
      const timings: number[] = [];
      const cacheHits: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        for (const query of queries) {
          const start = Date.now();
          const result = await TestHelper.runMindCommand(testDir, 'query', query);
          const duration = Date.now() - start;
          
          expect(result.exitCode).toBe(0);
          
          const data = JSON.parse(result.stdout);
          timings.push(data.meta.timingMs.total);
          cacheHits.push(data.meta.cached ? 1 : 0);
        }
      }
      
      // Analyze performance
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      const cacheHitRatio = cacheHits.reduce((a, b) => a + b, 0) / cacheHits.length;
      
      // Performance assertions
      expect(avgTiming).toBeLessThan(50); // Average < 50ms
      expect(cacheHitRatio).toBeGreaterThan(0.8); // Cache hit ratio > 80%
      
      // Verify no memory leaks (timings should stabilize)
      const firstHalf = timings.slice(0, timings.length / 2);
      const secondHalf = timings.slice(timings.length / 2);
      
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      // Second half should not be significantly slower
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);
    });

    it('should handle 1000 AI mode queries consistently', async () => {
      const queries = [
        ['meta', '--ai-mode', '--json'],
        ['docs', '--ai-mode', '--json'],
        ['exports', '--file', 'packages/core/src/index.ts', '--ai-mode', '--json']
      ];
      
      const iterations = 334; // ~1000 queries
      const summaries: string[] = [];
      const suggestions: string[][] = [];
      
      for (let i = 0; i < iterations; i++) {
        for (const query of queries) {
          const result = await TestHelper.runMindCommand(testDir, 'query', query);
          expect(result.exitCode).toBe(0);
          
          const data = JSON.parse(result.stdout);
          summaries.push(data.summary);
          suggestions.push(data.suggestNextQueries);
        }
      }
      
      // Verify AI mode consistency
      const uniqueSummaries = new Set(summaries);
      const uniqueSuggestions = new Set(suggestions.map(s => s.join('|')));
      
      // Should have consistent AI responses
      expect(uniqueSummaries.size).toBeLessThan(summaries.length * 0.1); // < 10% variation
      expect(uniqueSuggestions.size).toBeLessThan(suggestions.length * 0.1); // < 10% variation
    });
  });

  describe('Cache Behavior Stress', () => {
    it('should maintain cache consistency under concurrent-like load', async () => {
      const query = ['meta', '--json'];
      const iterations = 100;
      
      // Run same query many times
      const results = [];
      for (let i = 0; i < iterations; i++) {
        const result = await TestHelper.runMindCommand(testDir, 'query', query);
        expect(result.exitCode).toBe(0);
        results.push(JSON.parse(result.stdout));
      }
      
      // Verify cache behavior
      const firstResult = results[0];
      const cachedResults = results.slice(1);
      
      expect(firstResult.meta.cached).toBe(false);
      
      for (const result of cachedResults) {
        expect(result.meta.cached).toBe(true);
        expect(result.result).toEqual(firstResult.result);
        expect(result.summary).toBe(firstResult.summary);
        expect(result.suggestNextQueries).toEqual(firstResult.suggestNextQueries);
      }
    });

    it('should handle cache invalidation correctly', async () => {
      const query = ['meta', '--json'];
      
      // Initial query
      const initialResult = await TestHelper.runMindCommand(testDir, 'query', query);
      expect(initialResult.exitCode).toBe(0);
      const initialData = JSON.parse(initialResult.stdout);
      
      // Modify a file to trigger cache invalidation
      const testFile = join(testDir, 'packages/core/src/index.ts');
      const originalContent = await fsp.readFile(testFile, 'utf8');
      await fsp.writeFile(testFile, originalContent + '\n// Cache invalidation test\n');
      
      // Update indexes
      await TestHelper.runMindCommand(testDir, 'update');
      
      // Query should now be uncached
      const afterUpdateResult = await TestHelper.runMindCommand(testDir, 'query', query);
      expect(afterUpdateResult.exitCode).toBe(0);
      const afterUpdateData = JSON.parse(afterUpdateResult.stdout);
      
      expect(afterUpdateData.meta.cached).toBe(false);
      expect(afterUpdateData.meta.depsHash).not.toBe(initialData.meta.depsHash);
      
      // Restore original content
      await fsp.writeFile(testFile, originalContent);
      await TestHelper.runMindCommand(testDir, 'update');
    });
  });

  describe('Error Handling Stress', () => {
    it('should handle 1000 error queries without crashes', async () => {
      const errorQueries = [
        ['invalid-query', '--json'],
        ['exports', '--file', 'nonexistent.ts', '--json'],
        ['impact', '--file', 'nonexistent.ts', '--json']
      ];
      
      const iterations = 334; // ~1000 error queries
      const errorCodes: string[] = [];
      
      for (let i = 0; i < iterations; i++) {
        for (const query of errorQueries) {
          const result = await TestHelper.runMindCommand(testDir, 'query', query);
          expect(result.exitCode).toBe(1); // Should fail gracefully
          
          const data = JSON.parse(result.stdout);
          errorCodes.push(data.code);
          
          // Verify error structure
          expect(data.ok).toBe(false);
          expect(data.code).toBeDefined();
          expect(data.schemaVersion).toBe('1.0');
        }
      }
      
      // Verify consistent error handling
      const uniqueErrorCodes = new Set(errorCodes);
      expect(uniqueErrorCodes.size).toBeLessThan(10); // Should have consistent error codes
    });
  });

  describe('Memory Stability', () => {
    it('should maintain stable memory usage across many operations', async () => {
      const operations = [
        () => TestHelper.runMindCommand(testDir, 'query', ['meta', '--json']),
        () => TestHelper.runMindCommand(testDir, 'query', ['docs', '--json']),
        () => TestHelper.runMindCommand(testDir, 'query', ['exports', '--file', 'packages/core/src/index.ts', '--json']),
        () => TestHelper.runMindCommand(testDir, 'verify', ['--json'])
      ];
      
      const iterations = 250; // 1000 total operations
      const timings: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        for (const operation of operations) {
          const start = Date.now();
          const result = await operation();
          const duration = Date.now() - start;
          
          expect(result.exitCode).toBe(0);
          timings.push(duration);
        }
      }
      
      // Analyze timing stability
      const firstQuarter = timings.slice(0, timings.length / 4);
      const lastQuarter = timings.slice(-timings.length / 4);
      
      const firstQuarterAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
      const lastQuarterAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;
      
      // Performance should not degrade significantly
      expect(lastQuarterAvg).toBeLessThan(firstQuarterAvg * 2);
    });
  });

  describe('Concurrent-like Behavior', () => {
    it('should handle rapid successive queries without issues', async () => {
      const query = ['meta', '--json'];
      const batchSize = 50;
      const batches = 20; // 1000 total queries
      
      for (let batch = 0; batch < batches; batch++) {
        const promises = [];
        
        for (let i = 0; i < batchSize; i++) {
          promises.push(TestHelper.runMindCommand(testDir, 'query', query));
        }
        
        const results = await Promise.all(promises);
        
        // All queries should succeed
        for (const result of results) {
          expect(result.exitCode).toBe(0);
          
          const data = JSON.parse(result.stdout);
          expect(data.ok).toBe(true);
          expect(data.schemaVersion).toBe('1.0');
        }
      }
    });
  });
});
